import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dumbbellGeometry } from './gapGeometry.ts';
import { describeGap, NO_REAL_DIFFERENCE } from './gapPhrasing.ts';
import type { AccessGapMeasure } from '../../../store/atlasApi.js';

function measure(overrides: Partial<AccessGapMeasure> = {}): AccessGapMeasure {
  return {
    key: 'k',
    label: 'A measure',
    unit: 'PER_10K',
    lowest: 1,
    highest: 2,
    ratio: 2,
    higherIsBetter: true,
    note: 'a note',
    ...overrides,
  };
}

test('the larger end anchors the row at 100%', () => {
  const geometry = dumbbellGeometry(0.68, 1.01);
  assert.ok(geometry !== null);
  assert.equal(geometry.mostPercent, 100);
  assert.ok(Math.abs(geometry.leastPercent - 67.33) < 0.01);
});

test('the connector spans the two ends whichever is larger', () => {
  const rising = dumbbellGeometry(25, 100);
  assert.equal(rising?.connectorLeft, 25);
  assert.equal(rising?.connectorWidth, 75);

  const falling = dumbbellGeometry(100, 25);
  assert.equal(falling?.connectorLeft, 25);
  assert.equal(falling?.connectorWidth, 75);
});

test('equal ends collapse the connector to nothing', () => {
  const geometry = dumbbellGeometry(5, 5);
  assert.equal(geometry?.connectorWidth, 0);
  assert.equal(geometry?.leastPercent, 100);
});

test('a row with a missing end or no magnitude draws no dumbbell', () => {
  assert.equal(dumbbellGeometry(null, 1), null);
  assert.equal(dumbbellGeometry(1, null), null);
  assert.equal(dumbbellGeometry(0, 0), null);
});

test('a zero floor still plots, with the empty end pinned at the origin', () => {
  const geometry = dumbbellGeometry(0, 1.01);
  assert.equal(geometry?.leastPercent, 0);
  assert.equal(geometry?.mostPercent, 100);
});

test('shares are phrased in points, because a ratio has no direction', () => {
  assert.equal(
    describeGap(measure({ unit: 'SHARE', lowest: 0.55, highest: 0.66, ratio: 1.2 })),
    '11 points higher',
  );
  assert.equal(
    describeGap(measure({ unit: 'SHARE', lowest: 0.2, highest: 0.14, ratio: 0.72 })),
    '6 points lower',
  );
});

test('ratios read as a multiple in the direction they actually move', () => {
  assert.equal(describeGap(measure({ lowest: 0.68, highest: 1.01, ratio: 1.4833 })), '1.5× more');
  assert.equal(describeGap(measure({ lowest: 2, highest: 1, ratio: 0.5 })), '2.0× less');
});

test('differences too small to matter are named rather than dressed up', () => {
  assert.equal(
    describeGap(measure({ unit: 'SHARE', lowest: 0.5, highest: 0.502, ratio: 1.004 })),
    NO_REAL_DIFFERENCE,
  );
  assert.equal(describeGap(measure({ ratio: 1.0 })), NO_REAL_DIFFERENCE);
});

test('a measure missing either end has no gap to describe', () => {
  assert.equal(describeGap(measure({ lowest: null })), null);
  assert.equal(describeGap(measure({ highest: null })), null);
  assert.equal(describeGap(measure({ ratio: null })), null);
});
