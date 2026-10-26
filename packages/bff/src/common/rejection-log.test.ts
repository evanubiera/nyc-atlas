import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RejectionLog } from './rejection-log.js';
import { pointFromGeoreference, pointFromLatLonFields } from './geo-point.js';
import { NtaLocator } from './nta-locator.js';
import { countWhere, getOrCreate, sumOf } from './map-utils.js';

test('rejection log counts each reason separately and totals them', () => {
  const log = new RejectionLog();
  log.record('no coordinates');
  log.record('no coordinates');
  log.record('outside the city');

  assert.equal(log.countOf('no coordinates'), 2);
  assert.equal(log.countOf('outside the city'), 1);
  assert.equal(log.countOf('never happened'), 0);
  assert.equal(log.total, 3);
});

test('rejection log hands out a copy, so callers cannot mutate it', () => {
  const log = new RejectionLog();
  log.record('a');
  const snapshot = log.toMap();
  snapshot.set('a', 99);

  assert.equal(log.countOf('a'), 1);
});

test('rejection log absorbs another log without losing either side', () => {
  const left = new RejectionLog();
  left.record('shared');
  const right = new RejectionLog();
  right.record('shared');
  right.record('only right');

  left.absorb(right);
  assert.equal(left.countOf('shared'), 2);
  assert.equal(left.countOf('only right'), 1);
});

test('georeference yields a point only inside the city', () => {
  const inside = pointFromGeoreference({ type: 'Point', coordinates: [-73.98, 40.73] });
  assert.deepEqual(inside, { lon: -73.98, lat: 40.73 });

  assert.equal(pointFromGeoreference({ type: 'Point', coordinates: [-0.12, 51.5] }), null);
  assert.equal(pointFromGeoreference(null), null);
  assert.equal(pointFromGeoreference(undefined), null);
  assert.equal(pointFromGeoreference({ type: 'Point' }), null);
});

test('null island is rejected rather than placed', () => {
  assert.equal(pointFromGeoreference({ coordinates: [0, 0] }), null);
  assert.equal(pointFromLatLonFields('0', '0'), null);
});

test('lat/lon string fields parse, and non-numeric ones do not', () => {
  assert.deepEqual(pointFromLatLonFields('40.73', '-73.98'), { lon: -73.98, lat: 40.73 });
  assert.equal(pointFromLatLonFields('', ''), null);
  assert.equal(pointFromLatLonFields(undefined, undefined), null);
  assert.equal(pointFromLatLonFields('not a number', '-73.98'), null);
});

function locatorWith(known: string[], resolved: string | null): NtaLocator {
  return new NtaLocator({
    resolvePoint: () => resolved,
    getRecord: (code) => (known.includes(code) ? {} : undefined),
  });
}

test('a recognised upstream code is trusted without a polygon test', () => {
  const locator = locatorWith(['BK0101'], 'MN0101');
  assert.equal(locator.fromUpstreamCodeOrPoint('BK0101', { lon: -73.9, lat: 40.7 }), 'BK0101');
});

test('an unrecognised upstream code falls back to point-in-polygon', () => {
  const locator = locatorWith(['BK0101'], 'MN0101');
  assert.equal(locator.fromUpstreamCodeOrPoint('BK32', { lon: -73.9, lat: 40.7 }), 'MN0101');
  assert.equal(locator.fromUpstreamCodeOrPoint(undefined, { lon: -73.9, lat: 40.7 }), 'MN0101');
});

test('no point and no usable code places nothing', () => {
  const locator = locatorWith([], null);
  assert.equal(locator.fromPoint(null), null);
  assert.equal(locator.fromUpstreamCodeOrPoint('BK32', null), null);
});

test('getOrCreate inserts once and returns the same instance afterwards', () => {
  const map = new Map<string, { hits: number }>();
  let created = 0;
  const create = () => {
    created += 1;
    return { hits: 0 };
  };

  getOrCreate(map, 'a', create).hits += 1;
  getOrCreate(map, 'a', create).hits += 1;

  assert.equal(created, 1);
  assert.equal(map.get('a')?.hits, 2);
});

test('sumOf and countWhere walk any iterable', () => {
  const rows = [{ n: 1 }, { n: 2 }, { n: 3 }];
  assert.equal(sumOf(rows, (r) => r.n), 6);
  assert.equal(countWhere(rows, (r) => r.n > 1), 2);
  assert.equal(sumOf([], (r: { n: number }) => r.n), 0);
});
