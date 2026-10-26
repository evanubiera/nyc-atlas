import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateToNeighborhoods,
  countWithinRadius,
  metresBetween,
  WALKABLE_RADIUS_METRES,
  type TractCentroid,
} from './walkable-access.js';

const tract = (over: Partial<TractCentroid> = {}): TractCentroid => ({
  geoid: '36047001',
  nta2020: 'BK01',
  lon: -73.95,
  lat: 40.7,
  population: 1000,
  ...over,
});

test('distance matches a known separation closely enough to bound a radius', () => {
  // One degree of latitude is ~111.2 km.
  const d = metresBetween(-73.95, 40.0, -73.95, 41.0);
  assert.ok(Math.abs(d - 111_195) < 500, `got ${d}`);
});

test('an institution just inside the radius counts and one just outside does not', () => {
  const centre = tract();
  const nearLat = centre.lat + 700 / 111_320;
  const farLat = centre.lat + 900 / 111_320;

  assert.equal(countWithinRadius(centre, [{ lon: centre.lon, lat: nearLat }]), 1);
  assert.equal(countWithinRadius(centre, [{ lon: centre.lon, lat: farLat }]), 0);
});

test('the bounding-box reject never discards something inside the radius', () => {
  const centre = tract();
  // Due east, well inside 800 m, where the longitude padding matters most.
  const east = { lon: centre.lon + 600 / (111_320 * Math.cos((centre.lat * Math.PI) / 180)), lat: centre.lat };

  assert.equal(countWithinRadius(centre, [east]), 1);
});

test('a neighborhood is described by what its residents can reach, not its tracts', () => {
  // A big tract with nothing nearby and a tiny one surrounded by venues: the
  // population weighting must keep the result near the big tract's reality.
  const far = tract({ geoid: 'big', population: 9000, lat: 40.9 });
  const near = tract({ geoid: 'small', population: 1000 });
  const venues = [{ lon: near.lon, lat: near.lat }, { lon: near.lon, lat: near.lat }];

  const result = aggregateToNeighborhoods([far, near], venues);

  assert.equal(result['BK01']?.walkableInstitutions, 0.2);
  assert.equal(result['BK01']?.shareWithAnyWithinWalk, 0.1);
  assert.equal(result['BK01']?.tractCount, 2);
});

test('a neighborhood with no residents reports zero rather than dividing by zero', () => {
  const result = aggregateToNeighborhoods([tract({ population: 0 })], []);

  assert.equal(result['BK01']?.walkableInstitutions, 0);
  assert.equal(result['BK01']?.shareWithAnyWithinWalk, 0);
});

test('tracts with no neighborhood code are skipped rather than bucketed under empty', () => {
  const result = aggregateToNeighborhoods([tract({ nta2020: '' })], []);
  assert.deepEqual(Object.keys(result), []);
});

test('output key order is stable, so the cache stays byte-identical', () => {
  const a = aggregateToNeighborhoods([tract({ nta2020: 'QN02' }), tract({ nta2020: 'BK01' })], []);
  const b = aggregateToNeighborhoods([tract({ nta2020: 'BK01' }), tract({ nta2020: 'QN02' })], []);

  assert.deepEqual(Object.keys(a), Object.keys(b));
  assert.deepEqual(Object.keys(a), ['BK01', 'QN02']);
});

test('the radius is the conventional ten-minute walk', () => {
  assert.equal(WALKABLE_RADIUS_METRES, 800);
});
