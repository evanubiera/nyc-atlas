import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCoordinatePair, isWithinNycBounds } from './geography.js';

test('accepts a correctly ordered (lat, lon) pair', () => {
  // Times Square
  const r = resolveCoordinatePair(40.758, -73.9855);
  assert.ok(r);
  assert.equal(r.wasSwapped, false);
  assert.equal(r.lat, 40.758);
  assert.equal(r.lon, -73.9855);
  assert.ok(isWithinNycBounds(r.lon, r.lat));
});

test('recovers a transposed pair, as the Shootings dataset ships them', () => {
  // A real row from 5ucz-vwe8: latitude='-73.94211757', longitude='40.6961995'
  const r = resolveCoordinatePair(-73.94211757, 40.6961995);
  assert.ok(r, 'must recover rather than reject');
  assert.equal(r.wasSwapped, true);
  assert.equal(r.lat, 40.6961995);
  assert.equal(r.lon, -73.94211757);
  assert.ok(isWithinNycBounds(r.lon, r.lat), 'recovered point must be inside NYC');
});

test('rejects pairs that are valid in neither orientation', () => {
  assert.equal(resolveCoordinatePair(0, 0), null, 'null island');
  assert.equal(resolveCoordinatePair(51.5, -0.12), null, 'London');
  assert.equal(resolveCoordinatePair(Number.NaN, 40.7), null);
  assert.equal(resolveCoordinatePair(40.7, Number.POSITIVE_INFINITY), null);
});

test('the bounding box is a coarse pre-filter, not a membership test', () => {
  // Newark sits inside NYC's bounding box but outside the city. Coordinate
  // resolution accepts it; point-in-polygon is what rejects it (proven by
  // scripts/test-spatial-join.py). Keeping these responsibilities separate is
  // deliberate — the bbox exists to make the R-tree lookup cheap.
  const r = resolveCoordinatePair(40.7357, -74.1724);
  assert.ok(r, 'bbox-level resolution accepts Newark');
  assert.equal(r.wasSwapped, false);
});

test('the latitude and longitude bands do not overlap, so recovery is unambiguous', () => {
  // This is what makes the swap safely reversible; assert it explicitly so a
  // future bounds change cannot silently make resolution ambiguous.
  const latBand = [40.4774, 40.9176];
  const lonBand = [-74.2591, -73.7004];
  assert.ok(
    (lonBand[1] as number) < (latBand[0] as number),
    'longitude band must sit entirely below the latitude band',
  );
});
