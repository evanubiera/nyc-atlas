import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARROW_DIRECTIONS, nextInDirection, type Traversable } from './keyboardTraversal.ts';

const GRID: Traversable[] = [
  { nta2020: 'NW', name: 'north-west', centroid: [-74.0, 40.8] },
  { nta2020: 'NE', name: 'north-east', centroid: [-73.9, 40.8] },
  { nta2020: 'SW', name: 'south-west', centroid: [-74.0, 40.7] },
  { nta2020: 'SE', name: 'south-east', centroid: [-73.9, 40.7] },
];

const at = (code: string): Traversable => GRID.find((g) => g.nta2020 === code) as Traversable;

test('each arrow moves to the neighbour on that side', () => {
  assert.equal(nextInDirection(at('NW'), GRID, 'right')?.nta2020, 'NE');
  assert.equal(nextInDirection(at('NE'), GRID, 'left')?.nta2020, 'NW');
  assert.equal(nextInDirection(at('NW'), GRID, 'down')?.nta2020, 'SW');
  assert.equal(nextInDirection(at('SW'), GRID, 'up')?.nta2020, 'NW');
});

test('the nearest candidate wins, not merely the first in the list', () => {
  const far = { nta2020: 'FAR', name: 'far east', centroid: [-73.0, 40.8] };
  const near = { nta2020: 'NEAR', name: 'near east', centroid: [-73.95, 40.8] };

  assert.equal(nextInDirection(at('NW'), [far, near, ...GRID], 'right')?.nta2020, 'NEAR');
});

test('a diagonal neighbour is not offered for a sideways press', () => {
  // SE is right-and-down from NW; the vertical component dominates nothing,
  // but a candidate that is mostly north must not answer a "right" press.
  const mostlyNorth = { nta2020: 'N', name: 'north', centroid: [-73.99, 41.2] };

  assert.notEqual(nextInDirection(at('NW'), [mostlyNorth, ...GRID], 'right')?.nta2020, 'N');
});

test('at the edge of the city the selection holds rather than jumping', () => {
  assert.equal(nextInDirection(at('NE'), GRID, 'right')?.nta2020, 'NE');
  assert.equal(nextInDirection(at('NW'), GRID, 'up')?.nta2020, 'NW');
});

test('the first press with nothing selected lands north-west, predictably', () => {
  assert.equal(nextInDirection(null, GRID, 'right')?.nta2020, 'NW');
});

test('neighborhoods without a centroid are skipped rather than crashing', () => {
  const broken = { nta2020: 'X', name: 'no centroid', centroid: [] };

  assert.equal(nextInDirection(at('NW'), [broken, ...GRID], 'right')?.nta2020, 'NE');
  assert.equal(nextInDirection(null, [broken], 'right'), null);
});

test('every arrow key maps to a direction', () => {
  assert.deepEqual(Object.keys(ARROW_DIRECTIONS).sort(), [
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
  ]);
});
