import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CRIME_CATEGORY_META,
  isInScope,
  pearson,
  quantileBreaks,
  quintileAnalysis,
  type InstitutionScope,
  type Nta2020Code,
} from '@nyc-atlas/shared';
import { GeographyService, type NtaRecord } from '../geography/geography.service.js';
import { CacheService } from '../cache/cache.service.js';
import {
  CACHE_FILES,
  type AmenitiesCache,
  type DemographicsCache,
  type IncidentCache,
  type InstitutionCache,
  type QualityReport,
} from '../ingest/ingest.types.js';
import type { NtaDemographics } from '../census/census.service.js';
import type { UnifiedInstitution } from '../institutions/institutions.service.js';
import { buildNeighborhoodRow, type SmoothedRate } from './neighborhood-row.js';
import {
  countInstitutionsByNeighborhood,
  smoothRatesWithinBoroughs,
} from './outcome-rates.js';
import { adjustedAssociation, fitConfounderModel } from './confounder-model.js';
import {
  buildGapMeasures,
  collectGapCaveats,
  emptyGroup,
  exposureLabelFor,
  hasComparableExposure,
  MIN_ROWS_FOR_QUINTILES,
  splitByAccessQuintile,
  summarizeGroup,
} from './access-gaps.js';
import { collectComputeCaveats, residualAdjustmentCaveat } from './metrics-caveats.js';
import {
  buildInterpretation,
  TOO_FEW_FOR_ADJUSTMENT,
  UNADJUSTED_ONLY,
} from './correlation-interpretation.js';
import {
  CONFOUNDER_LABELS,
  type AccessGapsResult,
  type CorrelationSummary,
  type MetricsQuery,
  type MetricsResult,
  type NeighborhoodRow,
} from './metrics.types.js';

export type {
  MetricsQuery,
  MetricsResult,
  NeighborhoodRow,
  OutcomeMode,
  CorrelationSummary,
  AccessGapsResult,
  AccessGapMeasure,
  AccessGapGroup,
  GapUnit,
} from './metrics.types.js';

const SCALE_CLASSES = 7;
/** Land area scaled to 100k units so Poisson maths reads as incidents per 100 km². */
const SQKM_TO_RATE_DENOMINATOR = 1000;

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);

  private incidents: IncidentCache | null = null;
  private institutions: UnifiedInstitution[] = [];
  private demographics: DemographicsCache | null = null;
  private amenities: AmenitiesCache | null = null;
  private quality: QualityReport | null = null;

  constructor(
    private readonly geography: GeographyService,
    private readonly cache: CacheService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.incidents = await this.cache.read<IncidentCache>(CACHE_FILES.incidents);
    const institutions = await this.cache.read<InstitutionCache>(CACHE_FILES.institutions);
    this.institutions = institutions?.institutions ?? [];
    this.demographics = await this.cache.read<DemographicsCache>(CACHE_FILES.demographics);
    this.amenities = await this.cache.read<AmenitiesCache>(CACHE_FILES.amenities);
    this.quality = await this.cache.read<QualityReport>(CACHE_FILES.quality);

    if (this.incidents === null) {
      this.logger.warn('No ingest cache found — run `npm run ingest`. Metrics will be empty.');
      return;
    }

    this.logger.log(
      `Metrics ready: ${Object.keys(this.incidents.aggregate).length} NTAs with incidents, ` +
        `${this.institutions.length} institutions, ` +
        `demographics ${this.demographicsAvailable ? 'available' : 'unavailable'}, ` +
        `amenities ${this.amenitiesAvailable ? 'available' : 'unavailable'}`,
    );
  }

  get hasData(): boolean {
    return this.incidents !== null;
  }

  get demographicsAvailable(): boolean {
    return this.demographics?.available === true;
  }

  get amenitiesAvailable(): boolean {
    return this.amenities?.available === true;
  }

  get qualityReport(): QualityReport | null {
    return this.quality;
  }

  get period(): { from: string; to: string } {
    return {
      from: this.incidents?.earliestMonth ?? '',
      to: this.incidents?.latestMonth ?? '',
    };
  }

  getInstitutions(scope: InstitutionScope): UnifiedInstitution[] {
    return this.institutions.filter((institution) => isInScope(institution.scope, scope));
  }

  /**
   * The core join: crime counts, institution exposure and demographics per NTA,
   * with smoothing, intervals, and confounder-adjusted residuals.
   */
  compute(query: MetricsQuery): MetricsResult {
    const records = this.residentialRecordsFor(query);
    const demographics = this.demographics?.byNta ?? {};
    const amenities = this.amenities?.byNta ?? {};
    const demographicsAvailable = this.demographicsAvailable;

    const caveats = collectComputeCaveats(query.category, {
      amenitiesAvailable: this.amenitiesAvailable,
      demographicsAvailable,
    });

    const institutionCounts = countInstitutionsByNeighborhood(this.getInstitutions(query.scope));
    const incidentCounts = this.countIncidentsPerNeighborhood(records, query);
    const smoothedRates = demographicsAvailable
      ? smoothRatesWithinBoroughs(records, incidentCounts, demographics)
      : new Map<Nta2020Code, SmoothedRate>();

    const isEnforcementDriven = CRIME_CATEGORY_META[query.category].isEnforcementDriven;
    const rows = records.map((record) =>
      buildNeighborhoodRow({
        record,
        demographics: demographics[record.nta2020],
        amenities: amenities[record.nta2020],
        incidentCount: incidentCounts.get(record.nta2020) ?? 0,
        institutionCount: institutionCounts.get(record.nta2020) ?? 0,
        smoothedRate: smoothedRates.get(record.nta2020),
        exposure: query.exposure,
        demographicsAvailable,
        isEnforcementDriven,
      }),
    );

    const residualExtent = demographicsAvailable
      ? this.applyResiduals(rows, demographics, caveats)
      : null;

    return {
      outcomeMode: demographicsAvailable ? 'RATE_PER_100K' : 'COUNT_PER_SQKM',
      rows,
      scaleBreaks: buildScaleBreaks(rows),
      residualExtent,
      caveats,
      demographicsAvailable,
      period: { from: query.from, to: query.to },
    };
  }

  private residentialRecordsFor(query: MetricsQuery): NtaRecord[] {
    const records = this.geography.getResidentialRecords();
    const boroughCodes = query.boroughCodes;
    if (boroughCodes === undefined || boroughCodes.length === 0) return records;
    return records.filter((record) => boroughCodes.includes(record.boroughCode));
  }

  private countIncidentsPerNeighborhood(
    records: readonly NtaRecord[],
    query: MetricsQuery,
  ): Map<string, number> {
    const counts = new Map<string, number>();
    for (const record of records) {
      counts.set(record.nta2020, this.countInWindow(record.nta2020, query));
    }
    return counts;
  }

  /**
   * Fills each row's residual and returns the symmetric extent the diverging
   * scale needs.
   *
   * This is what separates a finding from an artifact: cultural institutions
   * cluster in wealthy neighborhoods, so a raw gradient mostly measures income.
   */
  private applyResiduals(
    rows: NeighborhoodRow[],
    demographics: Record<string, NtaDemographics>,
    caveats: string[],
  ): [number, number] | null {
    const fit = fitConfounderModel(rows, demographics);
    if (fit === null) return null;

    const rowsByNta = new Map(rows.map((row) => [row.nta2020, row]));
    for (const [nta2020, residual] of fit.residualByNta) {
      const row = rowsByNta.get(nta2020);
      if (row !== undefined) row.residual = residual;
    }

    caveats.push(residualAdjustmentCaveat(fit.rSquared));

    const bound = Math.max(...[...fit.residualByNta.values()].map(Math.abs));
    return [-bound, bound];
  }

  /** Quintile comparison across exposure, the headline view. */
  quintiles(query: MetricsQuery): ReturnType<typeof quintileAnalysis> {
    const result = this.compute(query);
    const isRateMode = result.outcomeMode === 'RATE_PER_100K';

    const comparable = result.rows.filter(
      (row) =>
        row.excluded === null &&
        row.exposureValue !== null &&
        (isRateMode ? row.population !== null : row.landAreaSqKm > 0),
    );

    return quintileAnalysis(
      comparable.map((row) => ({
        key: row.nta2020,
        exposure: row.exposureValue as number,
        count: row.rawCount,
        population: isRateMode
          ? (row.population as number)
          : row.landAreaSqKm * SQKM_TO_RATE_DENOMINATOR,
      })),
    );
  }

  /** Raw vs confounder-adjusted association between exposure and outcome. */
  correlation(query: MetricsQuery): CorrelationSummary {
    const result = this.compute(query);
    const demographics = this.demographics?.byNta ?? {};

    const usable = result.rows.filter(
      (row) =>
        row.excluded === null &&
        row.smoothedRatePer100k !== null &&
        row.exposureValue !== null &&
        (this.demographicsAvailable ? row.population !== null : true),
    );

    const raw = pearson(
      usable.map((row) => row.exposureValue as number),
      usable.map((row) => row.smoothedRatePer100k as number),
    );

    if (!this.demographicsAvailable) {
      return unadjustedOnly(raw, usable.length, UNADJUSTED_ONLY);
    }

    const association = adjustedAssociation(usable, demographics);
    if (association === null) {
      return unadjustedOnly(raw, usable.length, TOO_FEW_FOR_ADJUSTMENT);
    }

    return {
      raw,
      adjusted: association.adjusted,
      confounders: CONFOUNDER_LABELS,
      n: association.n,
      modelRSquared: association.modelRSquared,
      interpretation: buildInterpretation(raw, association.adjusted),
    };
  }

  /**
   * What else differs between the fifth of neighborhoods with the most cultural
   * institutions per resident and the fifth with the fewest.
   *
   * Every figure is pooled, not averaged across neighborhoods: a mean of
   * per-neighborhood rates lets a small NTA with one supermarket and 3,000
   * residents outweigh a large one with eight and 90,000. Pooling gives the
   * figure an actual resident of the group experiences.
   */
  accessGaps(query: MetricsQuery): AccessGapsResult {
    const result = this.compute(query);
    const comparable = result.rows.filter(hasComparableExposure);
    const exposureLabel = exposureLabelFor(query.exposure, result.demographicsAvailable);
    const availability = {
      amenitiesAvailable: this.amenitiesAvailable,
      demographicsAvailable: result.demographicsAvailable,
    };

    if (comparable.length < MIN_ROWS_FOR_QUINTILES) {
      return {
        measures: [],
        least: emptyGroup(),
        most: emptyGroup(),
        exposureLabel,
        ...availability,
        caveats: [
          `Only ${comparable.length} neighborhoods have both an exposure value and a ` +
            `population. A quintile contrast needs at least ${MIN_ROWS_FOR_QUINTILES}.`,
        ],
      };
    }

    const split = splitByAccessQuintile(comparable);
    return {
      measures: buildGapMeasures(split),
      least: summarizeGroup(split.least),
      most: summarizeGroup(split.most),
      exposureLabel,
      ...availability,
      caveats: collectGapCaveats(comparable, this.amenitiesAvailable),
    };
  }

  private countInWindow(nta2020: Nta2020Code, query: MetricsQuery): number {
    const months = this.incidents?.aggregate[nta2020]?.[query.category];
    if (months === undefined) return 0;

    const from = query.from.slice(0, 7);
    const to = query.to.slice(0, 7);

    let total = 0;
    for (const [month, count] of Object.entries(months)) {
      if (month >= from && month <= to) total += count;
    }
    return total;
  }
}

function unadjustedOnly(raw: number, n: number, interpretation: string): CorrelationSummary {
  return { raw, adjusted: null, confounders: [], n, modelRSquared: null, interpretation };
}

function buildScaleBreaks(rows: readonly NeighborhoodRow[]): number[] {
  const rates = rows
    .map((row) => row.smoothedRatePer100k)
    .filter((rate): rate is number => rate !== null);
  return rates.length > 0 ? quantileBreaks(rates, SCALE_CLASSES) : [];
}
