import { Injectable, Logger } from '@nestjs/common';
import { DATASETS, SCHOOL_QUALITY_YEAR, type Nta2020Code } from '@nyc-atlas/shared';
import { SocrataService } from '../socrata/socrata.service.js';
import { GeographyService } from '../geography/geography.service.js';
import { NtaLocator } from '../common/nta-locator.js';
import { RejectionLog } from '../common/rejection-log.js';
import { countWhere, getOrCreate, sumOf } from '../common/map-utils.js';
import {
  fetchFoodInspections,
  fetchFoodStoreLicences,
  fetchHealthcareFacilities,
  fetchSchoolLocations,
  fetchSchoolProficiency,
} from './amenities.queries.js';
import { tallyFoodStoresByNeighborhood } from './food-stores.js';
import {
  collapseToCurrentInspections,
  tallyGradesByNeighborhood,
  unplacedInspectionCount,
} from './store-grades.js';
import { tallyHealthcareByNeighborhood } from './healthcare.js';
import {
  DBN_HAS_NO_PUBLISHED_LOCATION,
  indexNeighborhoodsByDbn,
  poolProficiencyPerSchool,
  tallySchoolsByNeighborhood,
} from './schools.js';
import {
  emptyAmenities,
  type AmenitiesFetchResult,
  type NtaAmenities,
} from './amenities.types.js';

export type { NtaAmenities, AmenitiesFetchResult } from './amenities.types.js';

@Injectable()
export class AmenitiesService {
  private readonly logger = new Logger(AmenitiesService.name);

  constructor(
    private readonly socrata: SocrataService,
    private readonly geography: GeographyService,
  ) {}

  /**
   * Reduces grocery, healthcare and school-outcome data to a per-neighborhood
   * count or share.
   *
   * No source carries a trustworthy 2020 neighborhood code — food stores have
   * no neighborhood field at all and school locations carry a stale 2010 code —
   * so coordinates go through the same point-in-polygon index the crime join
   * uses.
   */
  async fetchAll(): Promise<AmenitiesFetchResult> {
    const rejections = new RejectionLog();
    const notes: string[] = [];
    const locator = new NtaLocator(this.geography);

    const [foodStores, storeGrades, healthcare, schools] = await Promise.all([
      this.collectFoodStores(locator, rejections),
      this.collectStoreGrades(locator, rejections, notes),
      this.collectHealthcare(locator, rejections),
      this.collectSchools(locator, rejections, notes),
    ]);

    const byNta = this.seedResidentialNeighborhoods();

    for (const [nta, tally] of foodStores) {
      const row = this.rowFor(byNta, nta);
      row.foodStoreCount = tally.total;
      row.supermarketCount = tally.supermarkets;
    }

    for (const [nta, tally] of storeGrades) {
      const row = this.rowFor(byNta, nta);
      row.gradedStoreCount = tally.graded;
      row.gradeAStoreCount = tally.passing;
      row.storeGradeShare = tally.graded > 0 ? tally.passing / tally.graded : null;
    }

    for (const [nta, tally] of healthcare) {
      const row = this.rowFor(byNta, nta);
      row.healthcareSiteCount = tally.sites;
      row.hospitalCount = tally.hospitals;
    }

    for (const [nta, tally] of schools) {
      const row = this.rowFor(byNta, nta);
      row.schoolCount = tally.schools;
      row.schoolStudents = Math.round(tally.students);
      row.schoolProficiency =
        tally.students > 0 ? tally.weightedProficiency / tally.students : null;
    }

    this.logCoverage(byNta);
    return { byNta, rejected: rejections.toMap(), notes };
  }

  /**
   * Every residential neighborhood gets a row even when it has nothing, so a
   * genuine zero stays distinguishable from a failed join downstream.
   */
  private seedResidentialNeighborhoods(): Map<Nta2020Code, NtaAmenities> {
    const byNta = new Map<Nta2020Code, NtaAmenities>();
    for (const record of this.geography.getResidentialRecords()) {
      byNta.set(record.nta2020, emptyAmenities(record.nta2020));
    }
    return byNta;
  }

  private rowFor(byNta: Map<Nta2020Code, NtaAmenities>, nta2020: Nta2020Code): NtaAmenities {
    return getOrCreate(byNta, nta2020, () => emptyAmenities(nta2020));
  }

  private async collectFoodStores(locator: NtaLocator, rejections: RejectionLog) {
    const rows = await fetchFoodStoreLicences(this.socrata);
    this.logger.log(`Fetched ${rows.length} NYC retail food store licences`);
    return tallyFoodStoresByNeighborhood(rows, locator, rejections);
  }

  private async collectStoreGrades(
    locator: NtaLocator,
    rejections: RejectionLog,
    notes: string[],
  ) {
    const rows = await fetchFoodInspections(this.socrata);
    this.logger.log(`Fetched ${rows.length} NYC food safety inspection rows`);

    const current = collapseToCurrentInspections(rows);
    const byNta = tallyGradesByNeighborhood(current, locator, rejections);

    notes.push(
      `Food store grades come from ${current.length.toLocaleString()} current inspections ` +
        `(collapsed from ${rows.length.toLocaleString()} deficiency rows); ` +
        `${unplacedInspectionCount(rejections)} could not be placed in a neighborhood. The ` +
        `grade is a sanitation result, not a measure of what a store sells or charges.`,
    );

    return byNta;
  }

  private async collectHealthcare(locator: NtaLocator, rejections: RejectionLog) {
    const rows = await fetchHealthcareFacilities(this.socrata);
    this.logger.log(`Fetched ${rows.length} FacDB healthcare facilities`);
    return tallyHealthcareByNeighborhood(rows, locator, rejections);
  }

  private async collectSchools(
    locator: NtaLocator,
    rejections: RejectionLog,
    notes: string[],
  ) {
    const [locations, quality] = await Promise.all([
      fetchSchoolLocations(this.socrata),
      fetchSchoolProficiency(this.socrata),
    ]);
    this.logger.log(
      `Fetched ${locations.length} school locations and ${quality.length} proficiency rows ` +
        `(${SCHOOL_QUALITY_YEAR})`,
    );

    const ntaByDbn = indexNeighborhoodsByDbn(locations, locator);
    const proficiencyByDbn = poolProficiencyPerSchool(quality, rejections);
    const byNta = tallySchoolsByNeighborhood(proficiencyByDbn, ntaByDbn, rejections);

    const unplaced = rejections.countOf(DBN_HAS_NO_PUBLISHED_LOCATION);
    if (unplaced > 0) {
      notes.push(
        `${unplaced} of ${proficiencyByDbn.size} schools with ${SCHOOL_QUALITY_YEAR} ` +
          `proficiency data could not be placed in a neighborhood: their DBN is absent from ` +
          `the 2019-20 school location file (${DATASETS.schoolLocations.id}), which is the ` +
          `newest vintage published. These are mostly charters that opened after 2020.`,
      );
    }

    return byNta;
  }

  private logCoverage(byNta: ReadonlyMap<Nta2020Code, NtaAmenities>): void {
    const rows = [...byNta.values()];
    this.logger.log(
      `Amenities: ${byNta.size} NTAs — ` +
        `${sumOf(rows, (r) => r.supermarketCount)} supermarkets of ` +
        `${sumOf(rows, (r) => r.foodStoreCount)} food stores, ` +
        `${sumOf(rows, (r) => r.gradeAStoreCount)} of ` +
        `${sumOf(rows, (r) => r.gradedStoreCount)} graded stores passing ` +
        `(${countWhere(rows, (r) => r.storeGradeShare !== null)} NTAs), ` +
        `${sumOf(rows, (r) => r.healthcareSiteCount)} healthcare sites, ` +
        `${countWhere(rows, (r) => r.schoolProficiency !== null)} NTAs with school proficiency`,
    );
  }
}
