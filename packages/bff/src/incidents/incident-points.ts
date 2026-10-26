import { EARLIEST_VALID_INCIDENT_DATE, resolveCoordinatePair } from '@nyc-atlas/shared';

/**
 * Point-level incidents for the hexbin layer (specs/008 §3.5).
 *
 * The ingest aggregates to NTA and month and keeps no points — a raw dump is
 * millions of rows and the disk budget forbids it. So points are fetched live
 * for the viewport instead, which is why the layer only appears at z13+: the
 * bound is what makes the query answerable at all.
 */

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface IncidentPoint {
  lon: number;
  lat: number;
  occurredOn: string;
}

/**
 * The largest viewport worth serving points for, in square degrees. Roughly a
 * z12 view of the city; anything wider is the choropleth's job, and lifting
 * this would pull six figures of rows per pan.
 */
export const MAX_BBOX_AREA_SQ_DEGREES = 0.08;

/** A hard ceiling independent of the bbox, so one pathological query cannot stall the BFF. */
export const MAX_INCIDENT_POINTS = 5000;

export function bboxArea(bbox: BoundingBox): number {
  return Math.abs(bbox.east - bbox.west) * Math.abs(bbox.north - bbox.south);
}

export function isBboxServiceable(bbox: BoundingBox): boolean {
  if (![bbox.west, bbox.south, bbox.east, bbox.north].every(Number.isFinite)) return false;
  if (bbox.east <= bbox.west || bbox.north <= bbox.south) return false;
  return bboxArea(bbox) <= MAX_BBOX_AREA_SQ_DEGREES;
}

/**
 * Filters server-side on the raw columns.
 *
 * The Shootings file ships latitude and longitude transposed in almost every
 * row, so the bbox is applied to both orderings and the rows are re-checked
 * here once `resolveCoordinatePair` has straightened them out. Filtering only
 * the nominal columns would drop 98.7% of shootings.
 */
export function buildBboxWhere(
  bbox: BoundingBox,
  dateColumn: string,
  from: string,
  to: string,
): string {
  const inNominal =
    `(latitude between ${bbox.south} and ${bbox.north} ` +
    `and longitude between ${bbox.west} and ${bbox.east})`;
  const inTransposed =
    `(longitude between ${bbox.south} and ${bbox.north} ` +
    `and latitude between ${bbox.west} and ${bbox.east})`;

  const start = from < EARLIEST_VALID_INCIDENT_DATE ? EARLIEST_VALID_INCIDENT_DATE : from;
  return (
    `(${inNominal} or ${inTransposed}) ` +
    `and ${dateColumn} >= '${start}T00:00:00' and ${dateColumn} <= '${to}T23:59:59'`
  );
}

/** Straightens each row's coordinates and drops anything still outside the box. */
export function toPointsWithinBbox(
  rows: readonly { latitude?: string; longitude?: string }[],
  bbox: BoundingBox,
  dateOf: (row: { latitude?: string; longitude?: string }) => string | undefined,
): IncidentPoint[] {
  const points: IncidentPoint[] = [];

  for (const row of rows) {
    const resolved = resolveCoordinatePair(Number(row.latitude), Number(row.longitude));
    if (resolved === null) continue;

    const { lon, lat } = resolved;
    if (lon < bbox.west || lon > bbox.east || lat < bbox.south || lat > bbox.north) continue;

    const date = dateOf(row);
    if (date === undefined || date === '') continue;

    points.push({ lon, lat, occurredOn: date.slice(0, 10) });
  }

  return points;
}
