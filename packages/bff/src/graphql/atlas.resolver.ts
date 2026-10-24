import { Args, Float, Int, Query, Resolver } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { DATASETS, MIN_POPULATION_FOR_RATE, NTA_TYPE_LABELS } from '@nyc-atlas/shared';
import { GeographyService, type NtaRecord } from '../geography/geography.service.js';
import { AppConfig } from '../config/configuration.js';
import { Exclusion, ExclusionKind, Neighborhood } from './models/neighborhood.model.js';
import { Capabilities, DatasetProvenance, Provenance } from './models/provenance.model.js';

const ATTRIBUTION =
  'Data: NYC Open Data (NYPD, DCLA, DCP) and U.S. Census Bureau ACS. ' +
  'This application shows statistical associations and does not establish causation.';

const INGEST_VERSION = '0.1.0-scaffold';

@Resolver()
export class AtlasResolver {
  private readonly logger = new Logger(AtlasResolver.name);

  constructor(
    private readonly geography: GeographyService,
    private readonly config: AppConfig,
  ) {}

  @Query(() => [Neighborhood], {
    description:
      'The 2020 NTAs. Non-residential areas are included but carry an `exclusion`, ' +
      'so the client can render them as excluded rather than omitting them silently.',
  })
  neighborhoods(
    @Args('residentialOnly', { type: () => Boolean, defaultValue: false })
    residentialOnly: boolean,
    @Args('boroughCode', { type: () => Int, nullable: true }) boroughCode?: number,
  ): Neighborhood[] {
    let records = residentialOnly
      ? this.geography.getResidentialRecords()
      : this.geography.getAllRecords();

    if (boroughCode !== undefined && boroughCode !== null) {
      records = records.filter((r) => r.boroughCode === boroughCode);
    }

    return records
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => toNeighborhood(r));
  }

  @Query(() => Neighborhood, { nullable: true })
  neighborhood(@Args('nta2020', { type: () => String }) nta2020: string): Neighborhood | null {
    const record = this.geography.getRecord(nta2020);
    return record ? toNeighborhood(record) : null;
  }

  @Query(() => String, {
    description:
      'Simplified NTA geometry as a GeoJSON FeatureCollection, serialised. ' +
      'Raw upstream geometry is 4.38 MB; this is reduced for transport (specs/001 NFR-3).',
  })
  neighborhoodGeometry(): string {
    return JSON.stringify(this.geography.getSimplifiedGeoJson());
  }

  @Query(() => Capabilities, {
    description: 'What this deployment can actually do with its current credentials.',
  })
  capabilities(): Capabilities {
    const all = this.geography.getAllRecords();
    const degraded: string[] = [];

    if (!this.config.hasCensusKey) {
      degraded.push(
        'Live ACS demographics unavailable: CENSUS_API_KEY is not set. The Census API ' +
          'rejects unkeyed requests. Get a free key at https://api.census.gov/data/key_signup.html',
      );
    }
    if (!this.geography.isLoaded) {
      degraded.push('NTA geography failed to load from NYC Open Data; the map cannot render.');
    }

    return {
      geographyLoaded: this.geography.isLoaded,
      neighborhoodCount: all.length,
      residentialNeighborhoodCount: all.filter((r) => r.isResidential).length,
      censusApiAvailable: this.config.hasCensusKey,
      socrataTokenConfigured: this.config.socrataAppToken !== null,
      degradedFeatures: degraded,
    };
  }

  @Query(() => Neighborhood, {
    nullable: true,
    description:
      'Resolves a coordinate to its NTA via R-tree bbox lookup plus exact ' +
      'point-in-polygon. Returns null for points outside every NTA, including ' +
      'geocoding failures such as (0,0). This is the spatial join that assigns ' +
      'crime incidents to neighborhoods — see specs/004.',
  })
  resolvePoint(
    @Args('lon', { type: () => Float }) lon: number,
    @Args('lat', { type: () => Float }) lat: number,
  ): Neighborhood | null {
    const code = this.geography.resolvePoint(lon, lat);
    if (code === null) return null;
    const record = this.geography.getRecord(code);
    return record ? toNeighborhood(record) : null;
  }

  @Query(() => Provenance, { description: 'Data lineage. Required by specs/001 FR-4.2.' })
  provenance(): Provenance {
    const datasets: DatasetProvenance[] = Object.values(DATASETS).map((ds) => ({
      id: ds.id,
      name: ds.name,
      purpose: ds.purpose,
      rowsUpdatedAt: null,
      rowCount: null,
      notes: 'notes' in ds ? (ds.notes ?? null) : null,
    }));

    return {
      datasets,
      ingestVersion: INGEST_VERSION,
      warnings: [
        'Scaffold build: metrics, incident ingest and ACS aggregation are not yet implemented.',
      ],
      attribution: ATTRIBUTION,
    };
  }
}

function toNeighborhood(r: NtaRecord): Neighborhood {
  return {
    nta2020: r.nta2020,
    name: r.name,
    boroughName: r.boroughName,
    boroughCode: r.boroughCode,
    cdta2020: r.cdta2020,
    landAreaSqKm: Number(r.landAreaSqKm.toFixed(4)),
    centroid: r.centroid,
    isResidential: r.isResidential,
    demographics: null,
    exclusion: buildExclusion(r),
  };
}

function buildExclusion(r: NtaRecord): Exclusion | null {
  if (!r.isResidential) {
    const label = NTA_TYPE_LABELS[r.ntatype] ?? 'Non-residential';
    return {
      kind: ExclusionKind.NON_RESIDENTIAL,
      ntatype: r.ntatype,
      population: null,
      explanation:
        `${label} — little or no residential population, so a per-capita rate would be ` +
        `meaningless or infinite.`,
    };
  }
  // Population-based exclusion is applied once ACS data is wired in; the
  // threshold lives in shared so client and server agree.
  void MIN_POPULATION_FOR_RATE;
  return null;
}
