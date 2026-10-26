import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NeighborhoodMetric } from '../../../store/atlasApi.js';
import { neighborhoodProvenance } from './neighborhoodProvenance.ts';

function row(overrides: Partial<NeighborhoodMetric> = {}): NeighborhoodMetric {
  return {
    nta2020: 'BK0101',
    name: 'Greenpoint',
    boroughName: 'Brooklyn',
    centroid: [-73.95, 40.73],
    population: 38000,
    rawCount: 12,
    ratePer100k: 31.5,
    smoothedRatePer100k: 29.4,
    confidenceInterval: [16, 55],
    institutionCount: 7,
    institutionsPerSqKm: 2.1,
    institutionsPer10k: 1.84,
    exposureValue: 1.84,
    residual: -3.2,
    medianHouseholdIncome: 102000,
    povertyRate: 0.11,
    shareBachelorsOrHigher: 0.62,
    foodStoreCount: 40,
    supermarketCount: 3,
    supermarketsPer10k: 0.79,
    gradedStoreCount: 31,
    gradeAStoreCount: 27,
    storeGradeShare: 0.871,
    healthcareSiteCount: 4,
    healthcareSitesPer10k: 1.05,
    schoolCount: 5,
    schoolStudents: 1400,
    schoolProficiency: 0.58,
    isEnforcementDriven: false, daytimePopulationSuspected: false,
    excluded: null,
    ...overrides,
  };
}

test('every measure cites a dataset, including the ones with nothing to show', () => {
  const entries = neighborhoodProvenance(
    row({ foodStoreCount: 0, supermarketCount: 0, gradedStoreCount: 0, schoolProficiency: null }),
    'SHOOTING',
  );

  for (const entry of entries) {
    assert.ok(entry.datasetId.length > 0, `${entry.measure} must cite a dataset`);
    assert.ok(entry.detail.length > 0, `${entry.measure} must say what it has`);
  }
});

test('an empty measure reads as a source with nothing here, not a missing source', () => {
  const entries = neighborhoodProvenance(row({ gradedStoreCount: 0, gradeAStoreCount: 0 }), 'SHOOTING');
  const grades = entries.find((e) => e.measure === 'Store grades');

  assert.equal(grades?.present, false);
  assert.match(grades?.detail ?? '', /no store here has a current inspection/i);
  assert.ok((grades?.datasetId ?? '').length > 0);
});

test('the outcome cites the shootings file for shootings and complaints otherwise', () => {
  const shooting = neighborhoodProvenance(row(), 'SHOOTING')[0];
  const drugs = neighborhoodProvenance(row(), 'DRUGS')[0];

  assert.equal(shooting?.datasetId, '5ucz-vwe8');
  assert.equal(drugs?.datasetId, '5uac-w243');
  assert.notEqual(shooting?.source, drugs?.source);
});

test('a neighborhood with no ACS estimate says so rather than showing a zero', () => {
  const entries = neighborhoodProvenance(row({ population: null, ratePer100k: null }), 'SHOOTING');
  const demographics = entries.find((e) => e.measure === 'Population & income');

  assert.equal(demographics?.present, false);
  assert.match(demographics?.detail ?? '', /no acs estimate/i);
  assert.match(entries[0]?.detail ?? '', /no rate without a population denominator/i);
});

test('the income note never lets a weighted mean of medians pass as a median', () => {
  const entries = neighborhoodProvenance(row(), 'SHOOTING');
  const demographics = entries.find((e) => e.measure === 'Population & income');

  assert.match(demographics?.detail ?? '', /not a true median/i);
});
