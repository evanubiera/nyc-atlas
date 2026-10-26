import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import RBush from 'rbush';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import centroid from '@turf/centroid';
import area from '@turf/area';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import {
  DATASETS,
  RESIDENTIAL_NTA_TYPE,
  isWithinNycBounds,
  type Nta2020Code,
} from '@nyc-atlas/shared';
import { SocrataService } from '../socrata/socrata.service.js';
import {
  SIMPLIFY_TOLERANCE,
  simplifyNtaCollection,
  type SimplifiedCollection,
} from './simplify-geometry.js';

type NtaFeature = Feature<Polygon | MultiPolygon, NtaProperties>;

/** Turf reports area in m²; every rate in this project is expressed per km². */
const SQ_METRES_PER_SQ_KM = 1_000_000;

interface NtaProperties {
  nta2020: string;
  ntaname: string;
  ntatype: string;
  boroname: string;
  borocode: string;
  cdta2020: string;
  cdtaname: string;
}

interface NtaIndexEntry {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  nta2020: Nta2020Code;
}

export interface NtaRecord {
  nta2020: Nta2020Code;
  name: string;
  ntatype: string;
  boroughName: string;
  boroughCode: number;
  cdta2020: string;
  landAreaSqKm: number;
  centroid: [number, number];
  isResidential: boolean;
}

/**
 * Loads the NTA geography and resolves points to neighborhoods.
 *
 * Two geometry representations are held deliberately:
 *   - `exactFeatures`   full-precision, used for point-in-polygon
 *   - `simplifiedCollection`  reduced, used for transport to the client
 *
 * Simplifying before the spatial join would misassign points near boundaries,
 * so simplification is strictly a presentation concern. See specs/004.
 */
@Injectable()
export class GeographyService implements OnModuleInit {
  private readonly logger = new Logger(GeographyService.name);

  private exactFeatures = new Map<Nta2020Code, NtaFeature>();
  private records = new Map<Nta2020Code, NtaRecord>();
  private index = new RBush<NtaIndexEntry>();
  private simplifiedCollection: SimplifiedCollection | null = null;
  private loaded = false;

  constructor(private readonly socrata: SocrataService) {}

  /**
   * Failure here is non-fatal: the app still boots and reports degraded state
   * rather than refusing to start when the upstream geography is unreachable.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.load();
    } catch (err) {
      this.logger.error(`NTA geography failed to load: ${String(err)}`);
    }
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  async load(): Promise<void> {
    if (this.loaded) return;

    this.logger.log('Loading 2020 NTA geography from Socrata…');
    const collection = await this.socrata.queryGeoJson(DATASETS.ntaGeography.id, { limit: 500 });
    const features = (collection.features ?? []) as unknown as NtaFeature[];

    const entries: NtaIndexEntry[] = [];

    for (const feature of features) {
      const props = feature.properties;
      if (!props?.nta2020 || !feature.geometry) continue;

      const code = props.nta2020;
      this.exactFeatures.set(code, feature);

      const bbox = computeBBox(feature);
      entries.push({ ...bbox, nta2020: code });

      const landAreaSqKm = area(feature) / SQ_METRES_PER_SQ_KM;
      const c = centroid(feature).geometry.coordinates;

      this.records.set(code, {
        nta2020: code,
        name: props.ntaname,
        ntatype: props.ntatype,
        boroughName: props.boroname,
        boroughCode: Number(props.borocode),
        cdta2020: props.cdta2020,
        landAreaSqKm,
        centroid: [c[0] as number, c[1] as number],
        isResidential: props.ntatype === RESIDENTIAL_NTA_TYPE,
      });
    }

    this.index.clear();
    this.index.load(entries);
    this.loaded = true;

    const residential = [...this.records.values()].filter((r) => r.isResidential).length;
    this.logger.log(
      `Loaded ${this.records.size} NTAs (${residential} residential, ` +
        `${this.records.size - residential} excluded as non-residential)`,
    );
  }

  /**
   * Resolves a coordinate to its NTA.
   *
   * R-tree bbox lookup narrows 262 polygons to usually one or two candidates,
   * then exact point-in-polygon runs only against those. This is what makes an
   * O(262 x N) problem tractable — see specs/004.
   *
   * Returns null for points outside every NTA (including geocoding failures,
   * which the bounds check rejects before any polygon test).
   */
  resolvePoint(lon: number, lat: number): Nta2020Code | null {
    if (!isWithinNycBounds(lon, lat)) return null;

    const candidates = this.index.search({ minX: lon, minY: lat, maxX: lon, maxY: lat });
    for (const candidate of candidates) {
      const feature = this.exactFeatures.get(candidate.nta2020);
      if (!feature) continue;
      if (booleanPointInPolygon([lon, lat], feature)) {
        return candidate.nta2020;
      }
    }
    return null;
  }

  getRecord(code: Nta2020Code): NtaRecord | undefined {
    return this.records.get(code);
  }

  getAllRecords(): NtaRecord[] {
    return [...this.records.values()];
  }

  getResidentialRecords(): NtaRecord[] {
    return this.getAllRecords().filter((r) => r.isResidential);
  }

  /**
   * Raw NTA GeoJSON is 4.38 MB; the transport budget
   * is under 600 KB gzipped (specs/001 NFR-3). The reduction itself lives in
   * `simplify-geometry.ts`, so the CI budget check measures the same bytes.
   */
  getSimplifiedGeoJson(tolerance = SIMPLIFY_TOLERANCE): SimplifiedCollection {
    if (this.simplifiedCollection) return this.simplifiedCollection;
    this.simplifiedCollection = simplifyNtaCollection(this.exactFeatures.values(), tolerance);
    return this.simplifiedCollection;
  }
}

function computeBBox(feature: NtaFeature): Omit<NtaIndexEntry, 'nta2020'> {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  forEachCoordinate(feature.geometry, (lon, lat) => {
    if (lon < minX) minX = lon;
    if (lat < minY) minY = lat;
    if (lon > maxX) maxX = lon;
    if (lat > maxY) maxY = lat;
  });

  return { minX, minY, maxX, maxY };
}

function forEachCoordinate(
  geometry: Polygon | MultiPolygon,
  visit: (lon: number, lat: number) => void,
): void {
  const rings =
    geometry.type === 'Polygon'
      ? geometry.coordinates
      : geometry.coordinates.flat();
  for (const ring of rings) {
    for (const position of ring) {
      const lon = position[0];
      const lat = position[1];
      if (typeof lon === 'number' && typeof lat === 'number') visit(lon, lat);
    }
  }
}
