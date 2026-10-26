import simplify from '@turf/simplify';
import type { Feature, MultiPolygon, Polygon } from 'geojson';

/**
 * Transport geometry, shared by the service that serves it and the CI check
 * that measures it.
 *
 * Keeping one implementation is the point: if the tolerance is ever loosened,
 * the budget check sees exactly the bytes the client would have received, so a
 * regression cannot slip past NFR-3 by measuring something else.
 */

/** Chosen against the raw 4.38 MB source; see specs/004. */
export const SIMPLIFY_TOLERANCE = 0.00004;

/** 5 decimal places is ~1 m — far beyond what the view resolves. */
export const COORDINATE_DECIMALS = 5;

/** specs/001 NFR-3: the simplified payload stays under 600 KB gzipped. */
export const GEOMETRY_BUDGET_BYTES = 600 * 1024;

/** The only properties the client needs; the rest are dropped in transport. */
export interface ClientNtaProperties {
  nta2020: string;
  ntaname: string;
  boroname: string;
  ntatype: string;
}

export interface SimplifiedCollection {
  type: 'FeatureCollection';
  features: unknown[];
}

type SourceFeature = Feature<Polygon | MultiPolygon, ClientNtaProperties>;

/**
 * Simplifies and quantises each feature, keeping only the client-facing
 * properties. The input is never mutated — callers hold the full-precision
 * geometry for point-in-polygon and must not have it reduced underneath them.
 */
export function simplifyNtaCollection(
  features: Iterable<SourceFeature>,
  tolerance: number = SIMPLIFY_TOLERANCE,
): SimplifiedCollection {
  const simplified = [...features].map((feature) => {
    const clone = structuredClone(feature);
    const reduced = simplify(clone, { tolerance, highQuality: false, mutate: true });
    quantizeCoordinates(reduced.geometry, COORDINATE_DECIMALS);
    const props = feature.properties;
    return {
      type: 'Feature' as const,
      geometry: reduced.geometry,
      properties: {
        nta2020: props.nta2020,
        ntaname: props.ntaname,
        boroname: props.boroname,
        ntatype: props.ntatype,
      },
    };
  });

  return { type: 'FeatureCollection', features: simplified };
}

function quantizeCoordinates(geometry: Polygon | MultiPolygon, decimals: number): void {
  const factor = 10 ** decimals;
  const round = (n: number): number => Math.round(n * factor) / factor;
  const rings =
    geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
  for (const ring of rings) {
    for (const position of ring) {
      if (typeof position[0] === 'number') position[0] = round(position[0]);
      if (typeof position[1] === 'number') position[1] = round(position[1]);
    }
  }
}
