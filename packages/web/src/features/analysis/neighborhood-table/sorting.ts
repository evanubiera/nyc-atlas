import type { NeighborhoodMetric } from '../../../store/atlasApi.js';

export type SortKey =
  | 'name'
  | 'medianHouseholdIncome'
  | 'supermarketsPer10k'
  | 'storeGradeShare'
  | 'schoolProficiency'
  | 'healthcareSitesPer10k'
  | 'institutionCount';

export interface SortState {
  key: SortKey;
  descending: boolean;
}

export function nextSortState(current: SortState, key: SortKey): SortState {
  if (current.key === key) return { key, descending: !current.descending };
  return { key, descending: key !== 'name' };
}

/**
 * Neighborhoods with no value sort to the bottom whichever way the column is
 * pointed, rather than masquerading as zero at one end.
 */
function compareNullableNumbers(left: number | null, right: number | null, direction: number): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction * (left - right);
}

export function sortNeighborhoods(
  rows: readonly NeighborhoodMetric[],
  sort: SortState,
): NeighborhoodMetric[] {
  const direction = sort.descending ? -1 : 1;

  return [...rows].sort((a, b) => {
    if (sort.key === 'name') return direction * a.name.localeCompare(b.name);
    return compareNullableNumbers(a[sort.key], b[sort.key], direction);
  });
}

export function withUsableRate(
  rows: readonly NeighborhoodMetric[],
): NeighborhoodMetric[] {
  return rows.filter((row) => row.excluded === null);
}
