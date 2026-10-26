import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateToUnits,
  compareGeographies,
  correlationOf,
  describeMaup,
  MAUP_AGREEMENT_THRESHOLD,
} from './maup.js';

const row = (unitKey: string, population: number | null, rawCount: number, institutionCount: number) => ({
  unitKey,
  population,
  rawCount,
  institutionCount,
});

test('rows roll up into their coarser unit, summing counts and population', () => {
  const units = aggregateToUnits([row('A', 1000, 5, 2), row('A', 3000, 15, 4), row('B', 2000, 1, 1)]);

  assert.equal(units.length, 2);
  assert.deepEqual(units[0], { unitKey: 'A', population: 4000, rawCount: 20, institutionCount: 6 });
});

test('a neighborhood with no population cannot contribute to a rate and is skipped', () => {
  const units = aggregateToUnits([row('A', null, 50, 9), row('A', 1000, 5, 1)]);

  assert.equal(units[0]?.population, 1000);
  assert.equal(units[0]?.rawCount, 5);
});

test('aggregation is deterministic in unit order', () => {
  const a = aggregateToUnits([row('B', 10, 1, 1), row('A', 10, 1, 1)]);
  const b = aggregateToUnits([row('A', 10, 1, 1), row('B', 10, 1, 1)]);

  assert.deepEqual(a, b);
});

test('too few units yield no correlation rather than a meaningless one', () => {
  assert.equal(correlationOf([{ unitKey: 'A', population: 1, rawCount: 1, institutionCount: 1 }]), null);
});

test('a result that holds across both geographies is reported as agreeing', () => {
  const fine = [
    { unitKey: 'a', population: 1000, rawCount: 10, institutionCount: 1 },
    { unitKey: 'b', population: 1000, rawCount: 20, institutionCount: 2 },
    { unitKey: 'c', population: 1000, rawCount: 30, institutionCount: 3 },
  ];
  const check = compareGeographies(fine, fine);

  assert.equal(check.shift, 0);
  assert.equal(check.agrees, true);
  assert.match(describeMaup(check), /survives the change of boundary/);
});

test('a correlation that reverses with the boundary is not reported as agreeing', () => {
  const fine = [
    { unitKey: 'a', population: 1000, rawCount: 10, institutionCount: 1 },
    { unitKey: 'b', population: 1000, rawCount: 20, institutionCount: 2 },
    { unitKey: 'c', population: 1000, rawCount: 30, institutionCount: 3 },
  ];
  const coarse = [
    { unitKey: 'x', population: 1000, rawCount: 30, institutionCount: 1 },
    { unitKey: 'y', population: 1000, rawCount: 20, institutionCount: 2 },
    { unitKey: 'z', population: 1000, rawCount: 10, institutionCount: 3 },
  ];
  const check = compareGeographies(fine, coarse);

  assert.equal(check.agrees, false);
  assert.match(describeMaup(check), /changes materially with the boundary/);
});

test('an unknowable check says so rather than implying the boundary is safe', () => {
  const check = compareGeographies([], []);

  assert.equal(check.agrees, false);
  assert.match(describeMaup(check), /unknown/);
});

test('the agreement threshold is a stated judgement, not a hidden constant', () => {
  assert.equal(MAUP_AGREEMENT_THRESHOLD, 0.15);
});
