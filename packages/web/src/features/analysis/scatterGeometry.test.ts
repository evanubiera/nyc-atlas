import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NeighborhoodMetric } from '../../store/atlasApi.js';
import {
  clampLabelAnchor,
  extentOf,
  project,
  selectExtremes,
  toScatterPoints,
  type ScatterPoint,
} from './scatterGeometry.ts';

function metric(over: Partial<NeighborhoodMetric>): NeighborhoodMetric {
  return {
    nta2020: 'BK01', name: 'A', boroughName: 'Brooklyn', centroid: [-73.9, 40.7],
    population: 1000, rawCount: 1, ratePer100k: 10, smoothedRatePer100k: 10,
    confidenceInterval: null, institutionCount: 1, institutionsPerSqKm: 1,
    institutionsPer10k: 1, exposureValue: 1, residual: null, medianHouseholdIncome: null,
    povertyRate: null, shareBachelorsOrHigher: null, foodStoreCount: 0, supermarketCount: 0,
    supermarketsPer10k: null, gradedStoreCount: 0, gradeAStoreCount: 0, storeGradeShare: null,
    healthcareSiteCount: 0, healthcareSitesPer10k: null, schoolCount: 0, schoolStudents: 0,
    schoolProficiency: null, isEnforcementDriven: false, daytimePopulationSuspected: false, excluded: null,
    ...over,
  };
}

const P = (nta2020: string, x: number, y: number): ScatterPoint => ({ nta2020, name: nta2020, x, y });

test('an excluded neighborhood is left off the plot entirely', () => {
  const rows = [metric({}), metric({ nta2020: 'X', excluded: { kind: 'NON_RESIDENTIAL', explanation: 'park' } })];
  assert.deepEqual(toScatterPoints(rows).map((p) => p.nta2020), ['BK01']);
});

test('a missing rate is dropped, never plotted as zero', () => {
  const rows = [metric({ smoothedRatePer100k: null }), metric({ nta2020: 'B', exposureValue: null })];
  assert.deepEqual(toScatterPoints(rows), []);
});

test('the extent is padded so points do not sit on the axis', () => {
  const { min, max } = extentOf([10, 20]);
  assert.ok(min < 10 && max > 20);
});

test('a single repeated value still yields a usable extent', () => {
  const { min, max } = extentOf([5, 5]);
  assert.ok(max > min);
});

test('an empty series does not produce a degenerate scale', () => {
  const { min, max } = extentOf([]);
  assert.ok(max > min);
});

test('projection places the ends of the domain at the ends of the range', () => {
  const extent = { min: 0, max: 10 };
  assert.equal(project(0, extent, 200), 0);
  assert.equal(project(10, extent, 200), 200);
  assert.equal(project(5, extent, 200), 100);
});

test('a zero-width domain pins to the middle rather than dividing by zero', () => {
  assert.equal(project(5, { min: 5, max: 5 }, 200), 100);
});

test('the four corners of the data are the ones labelled', () => {
  const points = [P('lowY', 5, 1), P('highY', 5, 99), P('lowX', 1, 50), P('highX', 99, 50)];
  const labelled = selectExtremes(points).map((p) => p.nta2020).sort();

  assert.deepEqual(labelled, ['highX', 'highY', 'lowX', 'lowY']);
});

test('a neighborhood extreme on two axes is labelled once', () => {
  const points = [P('corner', 99, 99), P('other', 1, 1)];
  assert.equal(selectExtremes(points).length, 2);
});

test('labels at the edge are anchored inward so they are not clipped', () => {
  assert.equal(clampLabelAnchor(2, 300), 'start');
  assert.equal(clampLabelAnchor(298, 300), 'end');
  assert.equal(clampLabelAnchor(150, 300), 'middle');
});
