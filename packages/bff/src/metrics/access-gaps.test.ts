import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGapMeasures,
  exposureLabelFor,
  hasComparableExposure,
  splitByAccessQuintile,
  summarizeGroup,
} from './access-gaps.js';
import { perTenThousand } from './group-pooling.js';
import type { NeighborhoodRow } from './metrics.types.js';

function row(overrides: Partial<NeighborhoodRow> = {}): NeighborhoodRow {
  return {
    nta2020: 'MN0101',
    name: 'Somewhere',
    boroughName: 'Manhattan',
    boroughCode: 1,
    landAreaSqKm: 2,
    centroid: [-73.98, 40.73],
    population: 10_000,
    rawCount: 0,
    ratePer100k: 0,
    smoothedRatePer100k: 0,
    confidenceInterval: null,
    institutionCount: 0,
    institutionsPerSqKm: 0,
    institutionsPer10k: 0,
    exposureValue: 0,
    residual: null,
    medianHouseholdIncome: 50_000,
    povertyRate: 0.2,
    shareBachelorsOrHigher: 0.3,
    foodStoreCount: 0,
    supermarketCount: 0,
    supermarketsPer10k: null,
    gradedStoreCount: 0,
    gradeAStoreCount: 0,
    storeGradeShare: null,
    healthcareSiteCount: 0,
    healthcareSitesPer10k: null,
    schoolCount: 0,
    schoolStudents: 0,
    schoolProficiency: null,
    isEnforcementDriven: false,
    excluded: null,
    ...overrides,
  };
}

test('only neighborhoods with an exposure value and residents are comparable', () => {
  assert.equal(hasComparableExposure(row()), true);
  assert.equal(hasComparableExposure(row({ exposureValue: null })), false);
  assert.equal(hasComparableExposure(row({ population: null })), false);
  assert.equal(hasComparableExposure(row({ population: 0 })), false);
  assert.equal(
    hasComparableExposure(row({ excluded: { kind: 'LOW_POPULATION', explanation: '' } })),
    false,
  );
});

test('the quintile split rounds up so no neighborhood is left unassigned at the top', () => {
  const rows = Array.from({ length: 197 }, (_, i) =>
    row({ nta2020: `N${i}`, exposureValue: i }),
  );
  const { least, most } = splitByAccessQuintile(rows);

  assert.equal(least.length, 40);
  assert.equal(most.length, 40);
  assert.equal(least[0]?.exposureValue, 0);
  assert.equal(most[most.length - 1]?.exposureValue, 196);
});

test('the split sorts by exposure rather than trusting input order', () => {
  const rows = [
    row({ nta2020: 'HIGH', exposureValue: 90 }),
    row({ nta2020: 'LOW', exposureValue: 1 }),
    row({ nta2020: 'MID', exposureValue: 40 }),
  ];
  const { least, most } = splitByAccessQuintile(rows);

  assert.equal(least[0]?.nta2020, 'LOW');
  assert.equal(most[most.length - 1]?.nta2020, 'HIGH');
});

test('a single neighborhood still yields a group rather than an empty slice', () => {
  const { least, most } = splitByAccessQuintile([row({ exposureValue: 5 })]);
  assert.equal(least.length, 1);
  assert.equal(most.length, 1);
});

test('gap measures pool stores over stores, not over neighborhoods', () => {
  const measures = buildGapMeasures({
    least: [
      row({ gradedStoreCount: 100, gradeAStoreCount: 50 }),
      row({ gradedStoreCount: 2, gradeAStoreCount: 2 }),
    ],
    most: [row({ gradedStoreCount: 10, gradeAStoreCount: 10 })],
  });

  const grades = measures.find((m) => m.key === 'storeGradeShare');
  assert.ok(grades !== undefined);
  assert.ok(Math.abs((grades.lowest as number) - 52 / 102) < 1e-12);
  assert.equal(grades.highest, 1);
});

test('every gap measure carries a direction and a note', () => {
  const measures = buildGapMeasures({ least: [row()], most: [row()] });
  const poverty = measures.find((m) => m.key === 'povertyRate');

  assert.equal(poverty?.higherIsBetter, false);
  for (const measure of measures) {
    assert.ok(measure.note.length > 0, `${measure.key} must explain what it measures`);
    assert.ok(measure.label.length > 0);
  }
});

test('a ratio needs both sides and a non-zero floor', () => {
  const measures = buildGapMeasures({
    least: [row({ supermarketCount: 0 })],
    most: [row({ supermarketCount: 5 })],
  });
  const supermarkets = measures.find((m) => m.key === 'supermarketsPer10k');

  assert.equal(supermarkets?.lowest, 0);
  assert.equal(supermarkets?.ratio, null);
});

test('a group summary pools population and names its largest neighborhoods', () => {
  const summary = summarizeGroup([
    row({ name: 'Small', population: 1_000, institutionCount: 1 }),
    row({ name: 'Large', population: 99_000, institutionCount: 9 }),
  ]);

  assert.equal(summary.neighborhoodCount, 2);
  assert.equal(summary.population, 100_000);
  assert.equal(summary.institutionsPer10k, 1);
  assert.deepEqual(summary.examples, ['Large', 'Small']);
});

test('the exposure label follows the denominator actually in use', () => {
  assert.match(exposureLabelFor('PER_CAPITA', true), /10,000 residents/);
  assert.match(exposureLabelFor('DENSITY', true), /km²/);
  assert.match(exposureLabelFor('PER_CAPITA', false), /km²/);
});

test('a per-10k rate needs a population to divide by', () => {
  assert.equal(perTenThousand(5, 10_000), 5);
  assert.equal(perTenThousand(0, 10_000), 0);
  assert.equal(perTenThousand(5, null), null);
  assert.equal(perTenThousand(5, 0), null);
  assert.equal(perTenThousand(undefined, 10_000), null);
});
