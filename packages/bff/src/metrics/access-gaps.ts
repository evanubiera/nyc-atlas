import {
  pooledPerTenThousand,
  pooledShare,
  populationWeightedMean,
  studentWeightedProficiency,
} from './group-pooling.js';
import {
  GROUPS_ARE_DESCRIBED_NOT_EXPLAINED,
  missingSchoolProficiencyCaveat,
  missingStoreGradeCaveat,
} from './metrics-caveats.js';
import type { AccessGapGroup, AccessGapMeasure, NeighborhoodRow } from './metrics.types.js';

export const MIN_ROWS_FOR_QUINTILES = 10;
const QUINTILES = 5;
const EXAMPLES_PER_GROUP = 3;

export interface AccessQuintileSplit {
  least: NeighborhoodRow[];
  most: NeighborhoodRow[];
}

export function hasComparableExposure(row: NeighborhoodRow): boolean {
  return (
    row.excluded === null &&
    row.exposureValue !== null &&
    row.population !== null &&
    row.population > 0
  );
}

export function exposureLabelFor(
  exposure: string,
  demographicsAvailable: boolean,
): string {
  return exposure === 'DENSITY' || !demographicsAvailable
    ? 'cultural institutions per km²'
    : 'cultural institutions per 10,000 residents';
}

/**
 * Splits neighborhoods into the least- and best-served fifths by cultural
 * access. The fifth is rounded up so 197 neighborhoods split into fifths of 40
 * rather than leaving three unassigned at the top.
 */
export function splitByAccessQuintile(rows: readonly NeighborhoodRow[]): AccessQuintileSplit {
  const sorted = [...rows].sort(
    (a, b) => (a.exposureValue as number) - (b.exposureValue as number),
  );
  const size = Math.max(1, Math.ceil(sorted.length / QUINTILES));
  return { least: sorted.slice(0, size), most: sorted.slice(-size) };
}

function ratioOf(lowest: number | null, highest: number | null): number | null {
  if (lowest === null || highest === null || lowest <= 0) return null;
  return highest / lowest;
}

type MeasureSpec = Omit<AccessGapMeasure, 'lowest' | 'highest' | 'ratio'> & {
  valueOf: (rows: readonly NeighborhoodRow[]) => number | null;
};

const MEASURE_SPECS: MeasureSpec[] = [
  {
    key: 'medianHouseholdIncome',
    label: 'Median household income',
    unit: 'USD',
    higherIsBetter: true,
    note:
      'Population-weighted mean of neighborhood medians, each itself a ' +
      'population-weighted mean of tract medians. Two approximations deep — read ' +
      'the gap, not the absolute figures.',
    valueOf: (rows) => populationWeightedMean(rows, (r) => r.medianHouseholdIncome),
  },
  {
    key: 'povertyRate',
    label: 'Residents below the poverty line',
    unit: 'SHARE',
    higherIsBetter: false,
    note: 'ACS poverty universe, pooled across the group.',
    valueOf: (rows) => populationWeightedMean(rows, (r) => r.povertyRate),
  },
  {
    key: 'supermarketsPer10k',
    label: 'Full-service supermarkets',
    unit: 'PER_10K',
    higherIsBetter: true,
    note:
      'Licensed food stores of 10,000 sq ft or more, per 10,000 residents. Floor area is ' +
      'self-reported at licensing and never audited, so this is the noisiest row here. ' +
      'Store count alone would mostly measure bodegas.',
    valueOf: (rows) => pooledPerTenThousand(rows, (r) => r.supermarketCount),
  },
  {
    key: 'storeGradeShare',
    label: 'Food stores passing inspection',
    unit: 'SHARE',
    higherIsBetter: true,
    note:
      'Share of food stores holding the top State inspection grade, pooled across the ' +
      'group’s stores. This is a sanitation result — whether a store is clean and ' +
      'storing food safely. It is not a measure of whether the produce is fresh, the ' +
      'prices are fair, or the shelves carry anything green.',
    valueOf: (rows) => pooledShare(rows, (r) => r.gradeAStoreCount, (r) => r.gradedStoreCount),
  },
  {
    key: 'schoolProficiency',
    label: 'Students at State Level 3-4',
    unit: 'SHARE',
    higherIsBetter: true,
    note:
      'ELA and Math pooled, weighted by students tested, elementary and middle schools. ' +
      'This is where a neighborhood’s schools sit, not where its children go — choice and ' +
      'screening move students across neighborhood lines in both directions.',
    valueOf: studentWeightedProficiency,
  },
  {
    key: 'healthcareSitesPer10k',
    label: 'Hospitals and clinics',
    unit: 'PER_10K',
    higherIsBetter: true,
    note:
      'Sites per 10,000 residents. A site is a site: this counts doors, not capacity, ' +
      'hours or whether they take your insurance.',
    valueOf: (rows) => pooledPerTenThousand(rows, (r) => r.healthcareSiteCount),
  },
];

export function buildGapMeasures(split: AccessQuintileSplit): AccessGapMeasure[] {
  return MEASURE_SPECS.map(({ valueOf, ...spec }) => {
    const lowest = valueOf(split.least);
    const highest = valueOf(split.most);
    return { ...spec, lowest, highest, ratio: ratioOf(lowest, highest) };
  });
}

export function summarizeGroup(rows: readonly NeighborhoodRow[]): AccessGapGroup {
  let population = 0;
  let institutions = 0;
  for (const row of rows) {
    population += row.population ?? 0;
    institutions += row.institutionCount;
  }

  return {
    neighborhoodCount: rows.length,
    population,
    institutionsPer10k: population > 0 ? (institutions / population) * 10_000 : null,
    examples: [...rows]
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
      .slice(0, EXAMPLES_PER_GROUP)
      .map((row) => row.name),
  };
}

export function emptyGroup(): AccessGapGroup {
  return { neighborhoodCount: 0, population: 0, institutionsPer10k: null, examples: [] };
}

export function collectGapCaveats(
  comparable: readonly NeighborhoodRow[],
  amenitiesAvailable: boolean,
): string[] {
  const caveats: string[] = [];

  if (!amenitiesAvailable) {
    caveats.push(
      'Grocery, school and healthcare rows are empty — the amenity stage of the last ingest ' +
        'produced nothing. Re-run `npm run ingest`.',
    );
  }

  const total = comparable.length;
  if (amenitiesAvailable) {
    const withGrades = comparable.filter((r) => r.storeGradeShare !== null).length;
    if (withGrades < total) caveats.push(missingStoreGradeCaveat(total - withGrades, total));

    const withSchools = comparable.filter((r) => r.schoolProficiency !== null).length;
    if (withSchools < total) {
      caveats.push(missingSchoolProficiencyCaveat(total - withSchools, total));
    }
  }

  caveats.push(GROUPS_ARE_DESCRIBED_NOT_EXPLAINED);
  return caveats;
}
