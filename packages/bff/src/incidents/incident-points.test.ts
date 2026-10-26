import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bboxArea,
  buildBboxWhere,
  isBboxServiceable,
  MAX_BBOX_AREA_SQ_DEGREES,
  toPointsWithinBbox,
} from './incident-points.js';

const MANHATTAN = { west: -74.02, south: 40.7, east: -73.95, north: 40.78 };

test('a viewport-sized box is serviceable and a citywide one is not', () => {
  assert.equal(isBboxServiceable(MANHATTAN), true);
  assert.equal(
    isBboxServiceable({ west: -74.3, south: 40.4, east: -73.6, north: 40.95 }),
    false,
    'the whole city must fall back to the choropleth',
  );
});

test('an inverted or non-finite box is refused rather than queried', () => {
  assert.equal(isBboxServiceable({ west: -73.9, south: 40.7, east: -74.0, north: 40.8 }), false);
  assert.equal(isBboxServiceable({ west: -74, south: 40.8, east: -73.9, north: 40.7 }), false);
  assert.equal(isBboxServiceable({ west: NaN, south: 40.7, east: -73.9, north: 40.8 }), false);
});

test('the area threshold is applied at its own boundary', () => {
  const box = { west: 0, south: 0, east: 0.2, north: MAX_BBOX_AREA_SQ_DEGREES / 0.2 };
  assert.ok(Math.abs(bboxArea(box) - MAX_BBOX_AREA_SQ_DEGREES) < 1e-12);
  assert.equal(isBboxServiceable(box), true);
});

test('the where clause matches both column orderings, because shootings arrive transposed', () => {
  const where = buildBboxWhere(MANHATTAN, 'occur_date', '2020-01-01', '2025-12-31');

  assert.ok(where.includes('latitude between 40.7 and 40.78'));
  assert.ok(where.includes('longitude between 40.7 and 40.78'), 'transposed rows must match too');
  assert.ok(where.includes(" or "));
});

test('a requested start before the data begins is clamped, not passed through', () => {
  const where = buildBboxWhere(MANHATTAN, 'occur_date', '1990-01-01', '2025-12-31');
  assert.ok(where.includes("occur_date >= '2006-01-01T00:00:00'"));
});

test('transposed rows are straightened and kept', () => {
  const rows = [{ latitude: '-73.98', longitude: '40.75' }];
  const points = toPointsWithinBbox(rows, MANHATTAN, () => '2024-05-01T00:00:00');

  assert.equal(points.length, 1);
  assert.equal(points[0]?.lon, -73.98);
  assert.equal(points[0]?.lat, 40.75);
});

test('rows the coarse query let through but that fall outside the box are dropped', () => {
  // Inside the transposed-OR arm upstream, but not actually in the viewport.
  const rows = [{ latitude: '40.9', longitude: '-73.80' }];
  assert.deepEqual(toPointsWithinBbox(rows, MANHATTAN, () => '2024-05-01'), []);
});

test('a row with no usable date is dropped rather than dated to the epoch', () => {
  const rows = [{ latitude: '40.75', longitude: '-73.98' }];
  assert.deepEqual(toPointsWithinBbox(rows, MANHATTAN, () => undefined), []);
});

test('the date is reduced to a day, never left as a timestamp', () => {
  const rows = [{ latitude: '40.75', longitude: '-73.98' }];
  const points = toPointsWithinBbox(rows, MANHATTAN, () => '2024-05-01T13:22:11.000');
  assert.equal(points[0]?.occurredOn, '2024-05-01');
});
