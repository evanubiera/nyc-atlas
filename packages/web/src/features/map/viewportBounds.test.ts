import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boundsOf, quantizeBounds, HEXBIN_MIN_ZOOM, LABEL_MIN_ZOOM } from './viewportBounds.ts';

const VIEW = { longitude: -73.98, latitude: 40.75, zoom: 13, pitch: 0, bearing: 0 };

test('an unmeasured canvas yields no bounds rather than a degenerate box', () => {
  assert.equal(boundsOf(VIEW, 0, 600), null);
  assert.equal(boundsOf(VIEW, 800, 0), null);
});

test('a measured canvas yields a box containing its own centre', () => {
  const bounds = boundsOf(VIEW, 800, 600);
  assert.ok(bounds);

  assert.ok(bounds.west < VIEW.longitude && VIEW.longitude < bounds.east);
  assert.ok(bounds.south < VIEW.latitude && VIEW.latitude < bounds.north);
});

test('zooming in narrows the box', () => {
  const wide = boundsOf({ ...VIEW, zoom: 11 }, 800, 600);
  const tight = boundsOf({ ...VIEW, zoom: 14 }, 800, 600);
  assert.ok(wide && tight);

  assert.ok(tight.east - tight.west < wide.east - wide.west);
});

test('bounds are quantized so a one-pixel nudge is not a new query', () => {
  const a = quantizeBounds({ west: -73.98012, south: 40.7501, east: -73.9601, north: 40.76009 });
  const b = quantizeBounds({ west: -73.98014, south: 40.75013, east: -73.96008, north: 40.76011 });

  assert.deepEqual(a, b);
});

test('the zoom thresholds keep the dense layer above the label layer', () => {
  assert.ok(HEXBIN_MIN_ZOOM > LABEL_MIN_ZOOM);
});
