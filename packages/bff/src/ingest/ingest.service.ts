import { Injectable, Logger } from '@nestjs/common';
import { DATASETS } from '@nyc-atlas/shared';
import { GeographyService } from '../geography/geography.service.js';
import {
  IncidentsService,
  mergeAggregates,
  type IncidentAggregate,
} from '../incidents/incidents.service.js';
import { InstitutionsService } from '../institutions/institutions.service.js';
import { AmenitiesService } from '../amenities/amenities.service.js';
import { CensusService } from '../census/census.service.js';
import { CacheService } from '../cache/cache.service.js';
import { IngestTally } from './ingest-tally.js';
import {
  CACHE_FILES,
  type AmenitiesCache,
  type DemographicsCache,
  type IncidentCache,
  type InstitutionCache,
  type ProvenanceCache,
  type WalkabilityCache,
} from './ingest.types.js';
import { SocrataService } from '../socrata/socrata.service.js';
import { ResumeService } from './resume.service.js';
import {
  aggregateToNeighborhoods,
  WALKABLE_RADIUS_METRES,
  type TractCentroid,
} from '../amenities/walkable-access.js';

export interface IngestOptions {
  /** Include the 2006-2019 historic complaint set (millions of rows). */
  includeHistoric?: boolean;
}

const HISTORIC_SKIPPED_NOTE =
  'Historic complaints (2006-2019, qgea-i56i) were not ingested. ' +
  'Run with --historic to include them; shootings already span 2006-present.';

const NO_CENSUS_KEY_NOTE =
  'No Census key: per-capita rates and confounder-adjusted views are unavailable.';

const NO_CENSUS_KEY_REASON =
  'CENSUS_API_KEY is not set. Rates and confounder adjustment require ' +
  'population denominators from the ACS.';

function transposedCoordinatesNote(repaired: number): string {
  return (
    `Repaired ${repaired.toLocaleString()} incident rows whose latitude and longitude ` +
    `columns were transposed upstream. The Shootings dataset (5ucz-vwe8) ships every ` +
    `record from 2006-01-01 to 2025-12-31 reversed; only 2026 additions are correct. ` +
    `Without this repair 98.7% of shootings would be silently discarded.`
  );
}

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private readonly geography: GeographyService,
    private readonly incidents: IncidentsService,
    private readonly institutions: InstitutionsService,
    private readonly census: CensusService,
    private readonly amenities: AmenitiesService,
    private readonly cache: CacheService,
    private readonly socrata: SocrataService,
    private readonly resume: ResumeService,
  ) {}

  async run(options: IngestOptions = {}): Promise<void> {
    const started = Date.now();
    await this.geography.load();

    const tally = new IngestTally();
    await this.resume.load();

    await this.ingestIncidents(tally, options.includeHistoric === true);
    await this.ingestInstitutions(tally);
    await this.ingestAmenities(tally);
    await this.ingestDemographics(tally);
    await this.ingestWalkability(tally);
    await this.recordProvenance();
    await this.resume.finish();

    if (tally.coordinatesRepaired > 0) {
      tally.note(transposedCoordinatesNote(tally.coordinatesRepaired));
    }
    await this.cache.write(CACHE_FILES.quality, tally.toQualityReport());

    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    this.logger.log(`Ingest complete in ${elapsed}s`);

    this.failOnUnmappedOffenses(tally);
  }

  private async ingestIncidents(tally: IngestTally, includeHistoric: boolean): Promise<void> {
    const shootings = await this.incidents.ingestShootings(this.resume);
    tally.absorbIncidents(DATASETS.shootings.id, shootings);

    const complaints = await this.incidents.ingestComplaints(
      DATASETS.complaintsCurrent.id,
      'current year-to-date',
      this.resume,
    );
    tally.absorbIncidents(DATASETS.complaintsCurrent.id, complaints);

    let aggregate = mergeAggregates(shootings.aggregate, complaints.aggregate);

    if (includeHistoric) {
      const historic = await this.incidents.ingestComplaints(
        DATASETS.complaintsHistoric.id,
        'historic 2006-2019',
        this.resume,
      );
      tally.absorbIncidents(DATASETS.complaintsHistoric.id, historic);
      aggregate = mergeAggregates(aggregate, historic.aggregate);
    } else {
      tally.note(HISTORIC_SKIPPED_NOTE);
    }

    await this.cache.write(CACHE_FILES.incidents, buildIncidentCache(aggregate));
  }

  private async ingestInstitutions(tally: IngestTally): Promise<void> {
    const { institutions, rejected } = await this.institutions.fetchAll();
    tally.absorbRejections('institutions', rejected);

    const cache: InstitutionCache = { institutions };
    await this.cache.write(CACHE_FILES.institutions, cache);
  }

  /**
   * Needs no credentials, so this stage is allowed to fail on its own without
   * taking the rest of the ingest with it.
   */
  private async ingestAmenities(tally: IngestTally): Promise<void> {
    let cache: AmenitiesCache;

    try {
      const amenities = await this.amenities.fetchAll();
      tally.absorbRejections('amenities', amenities.rejected);
      tally.note(...amenities.notes);
      cache = {
        byNta: Object.fromEntries(amenities.byNta),
        available: amenities.byNta.size > 0,
        unavailableReason: amenities.byNta.size > 0 ? null : 'amenity sources returned no rows',
      };
    } catch (err) {
      this.logger.error(`Amenity fetch failed: ${String(err)}`);
      cache = { byNta: {}, available: false, unavailableReason: `Amenity fetch failed: ${String(err)}` };
    }

    await this.cache.write(CACHE_FILES.amenities, cache);
  }

  private async ingestDemographics(tally: IngestTally): Promise<void> {
    await this.cache.write(CACHE_FILES.demographics, await this.buildDemographicsCache(tally));
  }

  private async buildDemographicsCache(tally: IngestTally): Promise<DemographicsCache> {
    if (!this.census.isAvailable) {
      tally.note(NO_CENSUS_KEY_NOTE);
      return { byNta: {}, available: false, unavailableReason: NO_CENSUS_KEY_REASON };
    }

    try {
      const byNta = await this.census.fetchNtaDemographics();
      return {
        byNta: Object.fromEntries(byNta),
        available: byNta.size > 0,
        unavailableReason: byNta.size > 0 ? null : 'ACS returned no rows',
      };
    } catch (err) {
      this.logger.error(`ACS fetch failed: ${String(err)}`);
      return { byNta: {}, available: false, unavailableReason: `ACS fetch failed: ${String(err)}` };
    }
  }

  /**
   * Upstream freshness for each Socrata dataset, written to its own file.
   *
   * Best-effort by design: this is a transparency sidecar, not an input to any
   * figure, so one unreachable dataset records nulls rather than failing a run
   * that has already written every cache (specs/008 §3.4).
   */
  /**
   * Walkable cultural access, measured around tract centroids (specs/008 §2.5).
   *
   * Allowed to fail on its own: it needs no credentials but it does need a
   * third geometry download, and an exposure measure the user may never
   * select should not take the rest of the ingest down with it.
   */
  private async ingestWalkability(tally: IngestTally): Promise<void> {
    try {
      const collection = await this.socrata.queryGeoJson(DATASETS.censusTracts.id, {
        limit: 3000,
      });

      const centroids: TractCentroid[] = [];
      for (const feature of (collection.features ?? []) as unknown as TractFeature[]) {
        const props = feature.properties;
        const centre = centroidOf(feature);
        if (!props?.nta2020 || centre === null) continue;

        centroids.push({
          geoid: props.geoid ?? '',
          nta2020: props.nta2020,
          lon: centre[0],
          lat: centre[1],
          // Tract population is not on this file; each tract weighs equally
          // within its neighborhood, which is the best this source supports.
          population: 1,
        });
      }

      const institutions = (
        await this.cache.read<InstitutionCache>(CACHE_FILES.institutions)
      )?.institutions ?? [];

      const byNta = aggregateToNeighborhoods(
        centroids,
        institutions.map((i) => ({ lon: i.lon, lat: i.lat })),
      );

      await this.cache.write(CACHE_FILES.walkability, {
        byNta,
        available: centroids.length > 0,
        radiusMetres: WALKABLE_RADIUS_METRES,
      } satisfies WalkabilityCache);

      tally.note(
        `Walkable access measured around ${centroids.length} tract centroids at ` +
          `${WALKABLE_RADIUS_METRES} m. Two limitations: distance is straight-line rather ` +
          `than along the street network, so reach is overstated wherever water, rail or a ` +
          `park edge breaks the grid; and the tract geometry file carries no population, so ` +
          `tracts weigh equally within a neighborhood instead of by residents.`,
      );
    } catch (err) {
      this.logger.warn(`Walkable access unavailable: ${String(err)}`);
      await this.cache.write(CACHE_FILES.walkability, {
        byNta: {},
        available: false,
        radiusMetres: WALKABLE_RADIUS_METRES,
      } satisfies WalkabilityCache);
    }
  }

  /** Recomputes walkable access alone; it reads institutions from the cache. */
  async refreshWalkability(): Promise<void> {
    await this.ingestWalkability(new IngestTally());
    this.logger.log(`Wrote ${CACHE_FILES.walkability}`);
  }

  async refreshProvenance(): Promise<void> {
    await this.recordProvenance();
    this.logger.log(`Wrote ${CACHE_FILES.provenance}`);
  }

  private async recordProvenance(): Promise<void> {
    const datasets: ProvenanceCache['datasets'] = {};

    for (const descriptor of Object.values(DATASETS)) {
      const domain = 'domain' in descriptor ? descriptor.domain : undefined;
      datasets[descriptor.id] = {
        rowsUpdatedAt: await this.rowsUpdatedAt(descriptor.id, domain),
        rowCount: await this.rowCount(descriptor.id, domain),
      };
    }

    await this.cache.write(CACHE_FILES.provenance, {
      generatedAt: new Date().toISOString(),
      datasets,
    } satisfies ProvenanceCache);
  }

  private async rowsUpdatedAt(id: string, domain: string | undefined): Promise<string | null> {
    try {
      const meta = await this.socrata.metadata(id, domain);
      // Socrata reports this as epoch seconds.
      return meta.rowsUpdatedAt ? new Date(meta.rowsUpdatedAt * 1000).toISOString() : null;
    } catch (err) {
      this.logger.warn(`No metadata for ${id}: ${String(err)}`);
      return null;
    }
  }

  private async rowCount(id: string, domain: string | undefined): Promise<number | null> {
    try {
      return await this.socrata.count(id, undefined, domain);
    } catch (err) {
      this.logger.warn(`No row count for ${id}: ${String(err)}`);
      return null;
    }
  }

  /**
   * An unmapped offense label would silently become UNKNOWN and disappear from
   * every category, so the run fails rather than writing a quietly wrong cache.
   */
  private failOnUnmappedOffenses(tally: IngestTally): void {
    const unmapped = tally.unmapped;
    if (unmapped.length === 0) return;

    throw new Error(
      `Ingest found ${unmapped.length} unmapped offense label(s): ${unmapped.join(', ')}. ` +
        `Add them to packages/shared/src/crime-categories.ts.`,
    );
  }
}

function buildIncidentCache(aggregate: IncidentAggregate): IncidentCache {
  const months = collectMonths(aggregate);
  return {
    aggregate,
    earliestMonth: months[0] ?? null,
    latestMonth: months[months.length - 1] ?? null,
  };
}

function collectMonths(aggregate: IncidentAggregate): string[] {
  const months = new Set<string>();
  for (const categories of Object.values(aggregate)) {
    for (const byMonth of Object.values(categories)) {
      for (const month of Object.keys(byMonth)) months.add(month);
    }
  }
  return [...months].sort();
}

interface TractFeature {
  properties?: { geoid?: string; nta2020?: string };
  geometry?: { type: string; coordinates: unknown };
}

/**
 * The mean of a polygon's vertices — enough for a walkable-radius centre, and
 * far cheaper than a true area centroid across 2,300 tracts.
 */
function centroidOf(feature: TractFeature): [number, number] | null {
  const geometry = feature.geometry;
  if (!geometry) return null;

  const rings =
    geometry.type === 'Polygon'
      ? (geometry.coordinates as number[][][])
      : (geometry.coordinates as number[][][][]).flat();

  let sumLon = 0;
  let sumLat = 0;
  let count = 0;

  for (const ring of rings) {
    for (const position of ring) {
      const [lon, lat] = position as [number, number];
      if (typeof lon !== 'number' || typeof lat !== 'number') continue;
      sumLon += lon;
      sumLat += lat;
      count += 1;
    }
  }

  return count === 0 ? null : [sumLon / count, sumLat / count];
}
