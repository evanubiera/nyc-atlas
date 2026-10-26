import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activityPerThousand,
  daytimeDistortionCaveat,
  DISTORTION_MULTIPLE,
  scanForDistortion,
  type ActivityInput,
} from './daytime-distortion.js';

const row = (over: Partial<ActivityInput> = {}): ActivityInput => ({
  nta2020: 'BK01',
  population: 10_000,
  institutionCount: 5,
  healthcareSiteCount: 3,
  foodStoreCount: 12,
  ...over,
});

/** Nine ordinary neighborhoods so the median is well defined. */
const ordinary = Array.from({ length: 9 }, (_, i) => row({ nta2020: `R${i}` }));

test('activity counts every destination against the residents', () => {
  assert.equal(activityPerThousand(row()), 2);
});

test('a tiny population yields no signal rather than a huge ratio', () => {
  assert.equal(activityPerThousand(row({ population: 120 })), null);
  assert.equal(activityPerThousand(row({ population: null })), null);
});

test('a central business district is flagged against its own city', () => {
  const midtown = row({
    nta2020: 'MN05',
    population: 20_000,
    institutionCount: 300,
    healthcareSiteCount: 60,
    foodStoreCount: 400,
  });
  const scan = scanForDistortion([...ordinary, midtown]);

  assert.ok(scan.suspected.has('MN05'));
  assert.ok(!scan.suspected.has('R0'));
});

test('an ordinary neighborhood is not flagged merely for having shops', () => {
  const busy = row({ nta2020: 'BUSY', foodStoreCount: 30 });
  const scan = scanForDistortion([...ordinary, busy]);

  assert.equal(scan.suspected.has('BUSY'), false);
});

test('the threshold follows the city rather than being a fixed constant', () => {
  const scan = scanForDistortion(ordinary);

  assert.equal(scan.medianActivity, 2);
  assert.equal(scan.threshold, 2 * DISTORTION_MULTIPLE);
});

test('a city with no usable population flags nothing instead of everything', () => {
  const scan = scanForDistortion([row({ population: null })]);

  assert.equal(scan.suspected.size, 0);
  assert.equal(scan.threshold, Infinity);
});

test('the caveat says the flag is inferred, not measured', () => {
  const text = daytimeDistortionCaveat(scanForDistortion(ordinary), 3);

  assert.match(text, /rather than measured/);
  assert.match(text, /should not be compared/);
});
