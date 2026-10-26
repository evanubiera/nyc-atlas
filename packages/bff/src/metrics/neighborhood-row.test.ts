import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN_POPULATION_FOR_RATE } from '@nyc-atlas/shared';
import { buildNeighborhoodRow, determineExclusion, type RowInputs } from './neighborhood-row.js';
import { buildInterpretation } from './correlation-interpretation.js';
import type { NtaRecord } from '../geography/geography.service.js';

const RECORD: NtaRecord = {
  nta2020: 'MN0101',
  name: 'Somewhere',
  ntatype: '0',
  boroughName: 'Manhattan',
  boroughCode: 1,
  cdta2020: 'MN01',
  landAreaSqKm: 2,
  centroid: [-73.98, 40.73],
  isResidential: true,
};

function inputs(overrides: Partial<RowInputs> = {}): RowInputs {
  return {
    record: RECORD,
    demographics: undefined,
    amenities: undefined,
    incidentCount: 0,
    institutionCount: 0,
    smoothedRate: undefined,
    exposure: 'PER_CAPITA',
    demographicsAvailable: true,
    isEnforcementDriven: false,
    ...overrides,
  };
}

function demographics(population: number) {
  return {
    nta2020: 'MN0101',
    population,
    povertyRate: 0.1,
    medianHouseholdIncome: 50_000,
    medianIncomeIsApproximated: true as const,
    shareAged15to24: 0.1,
    ownerOccupancyRate: 0.3,
    shareBachelorsOrHigher: 0.4,
    acsVintage: '2024 ACS 5-year',
    contributingTracts: 5,
  };
}

test('a missing Census key is a mode, not a per-neighborhood exclusion', () => {
  assert.equal(determineExclusion(null, false), null);
  assert.equal(determineExclusion(null, true)?.kind, 'NO_DEMOGRAPHICS');
});

test('a population below the rate floor is excluded with its number shown', () => {
  const exclusion = determineExclusion(MIN_POPULATION_FOR_RATE - 1, true);
  assert.equal(exclusion?.kind, 'LOW_POPULATION');
  assert.match(exclusion?.explanation ?? '', /dominated by noise/);

  assert.equal(determineExclusion(MIN_POPULATION_FOR_RATE, true), null);
});

test('amenity counts default to zero while their rates stay null without population', () => {
  const row = buildNeighborhoodRow(inputs());

  assert.equal(row.supermarketCount, 0);
  assert.equal(row.foodStoreCount, 0);
  assert.equal(row.healthcareSiteCount, 0);
  assert.equal(row.supermarketsPer10k, null);
  assert.equal(row.healthcareSitesPer10k, null);
  assert.equal(row.storeGradeShare, null);
  assert.equal(row.schoolProficiency, null);
});

test('a zero share is kept while an absent one stays null', () => {
  const row = buildNeighborhoodRow(
    inputs({
      demographics: demographics(10_000),
      amenities: {
        nta2020: 'MN0101',
        foodStoreCount: 4,
        supermarketCount: 0,
        gradedStoreCount: 4,
        gradeAStoreCount: 0,
        storeGradeShare: 0,
        healthcareSiteCount: 0,
        hospitalCount: 0,
        schoolCount: 0,
        schoolStudents: 0,
        schoolProficiency: null,
      },
    }),
  );

  assert.equal(row.storeGradeShare, 0, 'every store failing is not the same as none inspected');
  assert.equal(row.schoolProficiency, null);
  assert.equal(row.supermarketsPer10k, 0);
});

test('half-student counts are rounded, because the GraphQL field is an Int', () => {
  const row = buildNeighborhoodRow(
    inputs({
      demographics: demographics(10_000),
      amenities: {
        nta2020: 'MN0101',
        foodStoreCount: 0,
        supermarketCount: 0,
        gradedStoreCount: 0,
        gradeAStoreCount: 0,
        storeGradeShare: null,
        healthcareSiteCount: 0,
        hospitalCount: 0,
        schoolCount: 1,
        schoolStudents: 219.5,
        schoolProficiency: 0.5,
      },
    }),
  );

  assert.equal(row.schoolStudents, 220);
  assert.ok(Number.isInteger(row.schoolStudents));
});

test('exposure follows the selected measure, falling back to area without a Census key', () => {
  const perCapita = buildNeighborhoodRow(
    inputs({ demographics: demographics(10_000), institutionCount: 4 }),
  );
  assert.equal(perCapita.exposureValue, 4);
  assert.equal(perCapita.institutionsPerSqKm, 2);

  const byDensity = buildNeighborhoodRow(
    inputs({ demographics: demographics(10_000), institutionCount: 4, exposure: 'DENSITY' }),
  );
  assert.equal(byDensity.exposureValue, 2);

  const noCensus = buildNeighborhoodRow(
    inputs({ institutionCount: 4, demographicsAvailable: false }),
  );
  assert.equal(noCensus.exposureValue, 2);
});

test('without a Census key the rate slot carries area density instead of going null', () => {
  const row = buildNeighborhoodRow(
    inputs({ incidentCount: 10, demographicsAvailable: false }),
  );

  assert.equal(row.ratePer100k, 5);
  assert.equal(row.smoothedRatePer100k, 5);
  assert.equal(row.excluded, null);
});

test('the interpretation names the direction and changes with the adjustment', () => {
  const collapsed = buildInterpretation(-0.4, -0.05);
  assert.match(collapsed, /fewer incidents/);
  assert.match(collapsed, /Most of the raw association is explained/);

  const reversed = buildInterpretation(-0.4, 0.3);
  assert.match(reversed, /association reverses/);

  const persists = buildInterpretation(-0.4, -0.35);
  assert.match(persists, /substantial part of the association persists/);

  for (const text of [collapsed, reversed, persists]) {
    assert.match(text, /not a causal effect/);
  }
});
