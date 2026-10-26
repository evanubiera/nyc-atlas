import { pooledRate, weightedMean } from '@nyc-atlas/shared';
import type { NeighborhoodRow } from './metrics.types.js';

const PER_TEN_THOUSAND = 10_000;

export function perTenThousand(
  count: number | undefined,
  population: number | null,
): number | null {
  if (count === undefined || population === null || population <= 0) return null;
  return (count / population) * PER_TEN_THOUSAND;
}

export function pooledPerTenThousand(
  rows: readonly NeighborhoodRow[],
  pick: (row: NeighborhoodRow) => number,
): number | null {
  return pooledRate(
    rows.map((row) => ({ value: pick(row), weight: row.population })),
    PER_TEN_THOUSAND,
  );
}

/**
 * A share pooled over its own denominator rather than over population — here,
 * passing stores over graded stores. A neighborhood with 120 food stores and
 * one with 4 must not weigh the same.
 */
export function pooledShare(
  rows: readonly NeighborhoodRow[],
  numerator: (row: NeighborhoodRow) => number,
  denominator: (row: NeighborhoodRow) => number,
): number | null {
  return pooledRate(
    rows.map((row) => ({ value: numerator(row), weight: denominator(row) })),
    1,
  );
}

export function populationWeightedMean(
  rows: readonly NeighborhoodRow[],
  pick: (row: NeighborhoodRow) => number | null,
): number | null {
  return weightedMean(rows.map((row) => ({ value: pick(row), weight: row.population })));
}

export function studentWeightedProficiency(rows: readonly NeighborhoodRow[]): number | null {
  return weightedMean(
    rows.map((row) => ({ value: row.schoolProficiency, weight: row.schoolStudents })),
  );
}
