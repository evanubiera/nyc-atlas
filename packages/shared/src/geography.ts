/** 2020 NTA code, e.g. 'BX0101'. Six characters. */
export type Nta2020Code = string;

/** 11-digit census tract GEOID, e.g. '36005001901'. */
export type CensusTractGeoid = string;

/**
 * 2010 NTA codes ('BX01') are deliberately NOT modelled. Boundaries were redrawn
 * for 2020, not merely renamed, so joining 2010-coded data to 2020 geometry is
 * wrong. See specs/002-data-sources.md.
 */

export type BoroughCode = 1 | 2 | 3 | 4 | 5;

export interface Borough {
  readonly code: BoroughCode;
  readonly name: string;
  readonly abbrev: string;
  /** FIPS county code used by the Census API. */
  readonly countyFips: string;
}

export const BOROUGHS: readonly Borough[] = [
  { code: 1, name: 'Manhattan', abbrev: 'MN', countyFips: '061' },
  { code: 2, name: 'Bronx', abbrev: 'BX', countyFips: '005' },
  { code: 3, name: 'Brooklyn', abbrev: 'BK', countyFips: '047' },
  { code: 4, name: 'Queens', abbrev: 'QN', countyFips: '081' },
  { code: 5, name: 'Staten Island', abbrev: 'SI', countyFips: '085' },
] as const;

export const NYS_STATE_FIPS = '36';

/**
 * Only ntatype '0' is a residential neighborhood (197 of 262). The rest are
 * parks, cemeteries, airports and rail yards with little or no residential
 * population, and would yield meaningless or infinite per-capita rates.
 */
export const RESIDENTIAL_NTA_TYPE = '0';

/**
 * Verified against the live dataset on 2026-10-24 by inspecting every feature
 * name per type — not inferred from documentation, which does not state these.
 */
export const NTA_TYPE_LABELS: Readonly<Record<string, string>> = {
  '0': 'Residential neighborhood',
  '5': 'Correctional facility',
  '6': 'Institutional, military or rail yard',
  '7': 'Cemetery',
  '8': 'Airport',
  '9': 'Park',
};

/** Rejects geocoding failures, including the (0,0) null-island case. */
export const NYC_BOUNDS = {
  minLon: -74.2591,
  maxLon: -73.7004,
  minLat: 40.4774,
  maxLat: 40.9176,
} as const;

export function isWithinNycBounds(lon: number, lat: number): boolean {
  return (
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    lon >= NYC_BOUNDS.minLon &&
    lon <= NYC_BOUNDS.maxLon &&
    lat >= NYC_BOUNDS.minLat &&
    lat <= NYC_BOUNDS.maxLat
  );
}

/**
 * Do NOT derive a borough from the NTA code prefix.
 *
 * Verified 2026-10-24: exactly one of the 262 NTAs disagrees. Rikers Island is
 * coded `QN0151` (Queens prefix) but carries `boroname: 'Bronx'`,
 * `borocode: 2` — it is legally part of the Bronx but reached and administered
 * via Queens. Always read `borocode`/`boroname`, never `nta2020.slice(0, 2)`.
 */
export const NTA_CODE_PREFIX_IS_UNRELIABLE = true;

/**
 * Resolves a coordinate pair whose column order cannot be trusted.
 *
 * The Shootings dataset (5ucz-vwe8) ships its `latitude` and `longitude`
 * columns TRANSPOSED for 23,988 of its 24,310 rows — verified 2026-10-24. The
 * swap is time-correlated: every record from 2006-01-01 through 2025-12-31 is
 * reversed, while the 321 records added in 2026 are correct. A naive reader
 * either discards 98.7% of the city's shooting data on a bounds check, or plots
 * it off the coast of Africa.
 *
 * Recovery is unambiguous because NYC's latitude band [40.4, 41.0] and
 * longitude band [-74.3, -73.7] do not overlap: at most one assignment of the
 * two values can be valid. Returns null when neither orientation works, so
 * genuinely broken rows are still rejected rather than guessed at.
 *
 * Applied to every incident source, not just shootings — the complaint sets are
 * correctly oriented today, and this keeps a future regression from going
 * unnoticed.
 */
export function resolveCoordinatePair(
  a: number,
  b: number,
): { lon: number; lat: number; wasSwapped: boolean } | null {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  if (isPlausibleLat(a) && isPlausibleLon(b)) {
    return { lon: b, lat: a, wasSwapped: false };
  }
  if (isPlausibleLon(a) && isPlausibleLat(b)) {
    return { lon: a, lat: b, wasSwapped: true };
  }
  return null;
}

function isPlausibleLat(v: number): boolean {
  return v >= NYC_BOUNDS.minLat && v <= NYC_BOUNDS.maxLat;
}

function isPlausibleLon(v: number): boolean {
  return v >= NYC_BOUNDS.minLon && v <= NYC_BOUNDS.maxLon;
}

/** NTAs below this population get no rate display — see specs/007 §7. */
export const MIN_POPULATION_FOR_RATE = 1000;

/** Earliest trustworthy incident date. 58 rows carry impossible dates (min 1016-04-30). */
export const EARLIEST_VALID_INCIDENT_DATE = '2006-01-01';
