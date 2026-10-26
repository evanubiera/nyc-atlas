import type { SortKey } from './sorting.ts';

export interface TableColumn {
  key: SortKey;
  label: string;
  /** Second header line: the unit, so cells can stay bare numbers. */
  unit?: string;
  numeric: boolean;
  width: string;
  /** Hover text stating what the number is and what it is not. */
  title: string;
}

export const TABLE_COLUMNS: TableColumn[] = [
  {
    key: 'name',
    label: 'Neighborhood',
    numeric: false,
    width: '26%',
    title: '2020 Neighborhood Tabulation Area',
  },
  {
    key: 'medianHouseholdIncome',
    label: 'Income',
    unit: 'median household',
    numeric: true,
    width: '12%',
    title:
      'ACS median household income, aggregated from census tracts as a population-weighted ' +
      'mean of tract medians. Medians cannot be summed, so this is an approximation.',
  },
  {
    key: 'supermarketsPer10k',
    label: 'Groceries',
    unit: 'supermarkets / 10k',
    numeric: true,
    width: '13%',
    title:
      'Licensed food stores of 10,000 sq ft or more, per 10,000 residents. Floor area is ' +
      'self-reported at licensing and never audited. Hover a cell for the store counts behind it.',
  },
  {
    key: 'storeGradeShare',
    label: 'Store grade',
    unit: 'passing inspection',
    numeric: true,
    width: '13%',
    title:
      'Share of the neighborhood’s food stores holding the top State inspection grade. ' +
      'This is a sanitation result — whether a store is clean and storing food safely. It is ' +
      'NOT a measure of whether the produce is fresh, the prices are fair, or the shelves ' +
      'carry anything green. Citywide, 86% of stores pass.',
  },
  {
    key: 'schoolProficiency',
    label: 'Schools',
    unit: 'at State Level 3-4',
    numeric: true,
    width: '12%',
    title:
      'Share of tested students reaching NY State Level 3-4, ELA and Math pooled and weighted ' +
      'by students tested. Elementary and middle schools, 2024. Where the schools are, not ' +
      'where the children go.',
  },
  {
    key: 'healthcareSitesPer10k',
    label: 'Healthcare',
    unit: 'sites / 10k',
    numeric: true,
    width: '12%',
    title:
      'Hospitals, clinics and diagnostic & treatment centers per 10,000 residents. Counts ' +
      'doors, not capacity, hours or accepted insurance.',
  },
  {
    key: 'institutionCount',
    label: 'Cultural',
    unit: 'institutions',
    numeric: true,
    width: '12%',
    title: 'Cultural institutions at the selected scope. Expand a cell to list them.',
  },
];

export function labelFor(key: SortKey): string {
  return TABLE_COLUMNS.find((column) => column.key === key)?.label ?? key;
}
