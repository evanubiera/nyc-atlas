/**
 * Walkable cultural access (specs/008 §2.5).
 *
 * Institutions per resident treats a neighborhood as a single point: a venue
 * at the far edge counts the same as one on the corner. Walkable access asks
 * a different question — how many institutions are within walking distance of
 * where people actually live — by counting around tract centroids rather than
 * the neighborhood as a whole, then rolling up weighted by tract population.
 *
 * 800 m is the conventional walkable radius, roughly a ten-minute walk. It is
 * straight-line distance, not street network: this overstates access wherever
 * a rail cut, a park edge or the water breaks the grid, which is a real
 * limitation and not a rounding error.
 */

/** ~10 minutes on foot; the standard planning radius. */
export const WALKABLE_RADIUS_METRES = 800;

const EARTH_RADIUS_METRES = 6_371_000;

export interface TractCentroid {
  geoid: string;
  nta2020: string;
  lon: number;
  lat: number;
  population: number;
}

export interface InstitutionLocation {
  lon: number;
  lat: number;
}

/**
 * Great-circle distance. Turf would do this, but the inner loop runs a few
 * million times and this avoids allocating a feature per comparison.
 */
export function metresBetween(
  aLon: number,
  aLat: number,
  bLon: number,
  bLat: number,
): number {
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLon = (bLon - aLon) * toRad;
  const lat1 = aLat * toRad;
  const lat2 = bLat * toRad;

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function countWithinRadius(
  centroid: TractCentroid,
  institutions: readonly InstitutionLocation[],
  radiusMetres = WALKABLE_RADIUS_METRES,
): number {
  // A degree of latitude is ~111 km everywhere; longitude shrinks with
  // latitude. The box is a cheap reject before the trigonometry.
  const latPad = radiusMetres / 111_320;
  const lonPad = latPad / Math.max(0.1, Math.cos((centroid.lat * Math.PI) / 180));

  let count = 0;
  for (const institution of institutions) {
    if (Math.abs(institution.lat - centroid.lat) > latPad) continue;
    if (Math.abs(institution.lon - centroid.lon) > lonPad) continue;
    if (metresBetween(centroid.lon, centroid.lat, institution.lon, institution.lat) <= radiusMetres) {
      count += 1;
    }
  }
  return count;
}

export interface WalkableAccess {
  /** Population-weighted mean institutions within the radius, per NTA. */
  walkableInstitutions: number;
  /** Share of the neighborhood's residents with at least one within reach. */
  shareWithAnyWithinWalk: number;
  tractCount: number;
}

/**
 * Weighted by tract population, so a neighborhood is described by what its
 * residents can reach rather than by the average of its tracts. An empty
 * tract would otherwise count as much as a full one.
 */
export function aggregateToNeighborhoods(
  centroids: readonly TractCentroid[],
  institutions: readonly InstitutionLocation[],
  radiusMetres = WALKABLE_RADIUS_METRES,
): Record<string, WalkableAccess> {
  const totals = new Map<
    string,
    { population: number; weighted: number; covered: number; tracts: number }
  >();

  for (const centroid of centroids) {
    if (!centroid.nta2020) continue;

    const within = countWithinRadius(centroid, institutions, radiusMetres);
    const entry = totals.get(centroid.nta2020) ?? {
      population: 0,
      weighted: 0,
      covered: 0,
      tracts: 0,
    };

    entry.population += centroid.population;
    entry.weighted += within * centroid.population;
    if (within > 0) entry.covered += centroid.population;
    entry.tracts += 1;
    totals.set(centroid.nta2020, entry);
  }

  const byNta: Record<string, WalkableAccess> = {};
  for (const [nta, entry] of [...totals].sort(([a], [b]) => (a < b ? -1 : 1))) {
    byNta[nta] = {
      walkableInstitutions: entry.population > 0 ? entry.weighted / entry.population : 0,
      shareWithAnyWithinWalk: entry.population > 0 ? entry.covered / entry.population : 0,
      tractCount: entry.tracts,
    };
  }
  return byNta;
}
