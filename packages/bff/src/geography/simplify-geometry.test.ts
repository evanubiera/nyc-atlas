import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Feature, Polygon } from 'geojson';
import {
  COORDINATE_DECIMALS,
  SIMPLIFY_TOLERANCE,
  simplifyNtaCollection,
  type ClientNtaProperties,
} from './simplify-geometry.js';

/** A square with enough unquantised precision to show rounding. */
function square(code: string): Feature<Polygon, ClientNtaProperties> {
  return {
    type: 'Feature',
    properties: { nta2020: code, ntaname: `NTA ${code}`, boroname: 'Brooklyn', ntatype: '0' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-73.9876543219, 40.1234567891],
          [-73.9776543219, 40.1234567891],
          [-73.9776543219, 40.1334567891],
          [-73.9876543219, 40.1334567891],
          [-73.9876543219, 40.1234567891],
        ],
      ],
    },
  };
}

test('the source features are never reduced underneath the caller', () => {
  const source = square('BK0101');
  const before = structuredClone(source.geometry.coordinates);

  simplifyNtaCollection([source]);

  assert.deepEqual(source.geometry.coordinates, before);
});

test('coordinates are quantised to the declared precision', () => {
  const collection = simplifyNtaCollection([square('BK0101')]);
  const feature = collection.features[0] as Feature<Polygon, ClientNtaProperties>;

  for (const [lon, lat] of feature.geometry.coordinates[0]!) {
    assert.equal(lon, Number((lon as number).toFixed(COORDINATE_DECIMALS)));
    assert.equal(lat, Number((lat as number).toFixed(COORDINATE_DECIMALS)));
  }
});

test('only the four client-facing properties survive transport', () => {
  const source = square('BK0101');
  (source.properties as unknown as Record<string, unknown>).cdtaname = 'Brooklyn CD 1';

  const collection = simplifyNtaCollection([source]);
  const feature = collection.features[0] as Feature<Polygon, ClientNtaProperties>;

  assert.deepEqual(Object.keys(feature.properties).sort(), [
    'boroname',
    'nta2020',
    'ntaname',
    'ntatype',
  ]);
});

test('every feature is carried through, in order', () => {
  const collection = simplifyNtaCollection([square('BK0101'), square('QN0202')]);
  const codes = collection.features.map(
    (f) => (f as Feature<Polygon, ClientNtaProperties>).properties.nta2020,
  );

  assert.equal(collection.type, 'FeatureCollection');
  assert.deepEqual(codes, ['BK0101', 'QN0202']);
});

test('the shipped tolerance is the one the budget check measures', () => {
  // A drift here silently changes the payload the client downloads, so the
  // value is pinned rather than left to whoever last edited the service.
  assert.equal(SIMPLIFY_TOLERANCE, 0.00004);
});
