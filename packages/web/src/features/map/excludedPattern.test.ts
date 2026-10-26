import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hatchPatternDataUri,
  PATTERN_MAPPING,
  PATTERN_NAME,
  PATTERN_SIZE,
} from './excludedPattern.ts';

test('the mapping covers the whole atlas, or the hatch would be cropped', () => {
  const entry = PATTERN_MAPPING[PATTERN_NAME];

  assert.equal(entry.x, 0);
  assert.equal(entry.y, 0);
  assert.equal(entry.width, PATTERN_SIZE);
  assert.equal(entry.height, PATTERN_SIZE);
});

test('the pattern is a mask, so the theme tints it rather than the SVG fixing a colour', () => {
  assert.equal(PATTERN_MAPPING[PATTERN_NAME].mask, true);
});

test('the atlas is a decodable SVG data URI of the declared size', () => {
  const uri = hatchPatternDataUri();
  assert.ok(uri.startsWith('data:image/svg+xml;base64,'));

  const svg = Buffer.from(uri.split(',')[1] as string, 'base64').toString('utf8');
  assert.ok(svg.includes(`width="${PATTERN_SIZE}"`));
  assert.ok(svg.includes(`height="${PATTERN_SIZE}"`));
  assert.ok(svg.includes('stroke="white"'), 'a mask must be drawn in white');
});

test('the hatch runs past both corners, so it tiles without visible seams', () => {
  const svg = Buffer.from(hatchPatternDataUri().split(',')[1] as string, 'base64').toString('utf8');

  // The three strokes: one crossing the tile and two overlapping the corners.
  assert.ok(svg.includes('M-4,4'));
  assert.ok(svg.includes('M12,20'));
});
