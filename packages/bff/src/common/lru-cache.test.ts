import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LruCache } from './lru-cache.js';

/** A clock the test moves by hand, so expiry needs no real waiting. */
function fakeClock(start = 0): { now: () => number; advance: (ms: number) => void } {
  let t = start;
  return { now: () => t, advance: (ms) => void (t += ms) };
}

test('a stored value is returned until it expires, and never after', () => {
  const clock = fakeClock();
  const cache = new LruCache<string, number>(10, 1000, clock.now);
  cache.set('a', 1);

  assert.equal(cache.get('a'), 1);
  clock.advance(999);
  assert.equal(cache.get('a'), 1);
  clock.advance(1);
  assert.equal(cache.get('a'), undefined);
});

test('an expired entry is dropped rather than left occupying the cap', () => {
  const clock = fakeClock();
  const cache = new LruCache<string, number>(10, 1000, clock.now);
  cache.set('a', 1);
  clock.advance(2000);

  cache.get('a');
  assert.equal(cache.size, 0);
});

test('the least recently used key is the one evicted at the cap', () => {
  const cache = new LruCache<string, number>(2, 60_000);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.get('a'); // 'a' is now the most recent, so 'b' is next out
  cache.set('c', 3);

  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('c'), 3);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.size, 2);
});

test('overwriting a key refreshes both its value and its recency', () => {
  const cache = new LruCache<string, number>(2, 60_000);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('a', 99);
  cache.set('c', 3);

  assert.equal(cache.get('a'), 99);
  assert.equal(cache.get('b'), undefined);
});

test('clearing drops everything, for when the data underneath is replaced', () => {
  const cache = new LruCache<string, number>(4, 60_000);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.clear();

  assert.equal(cache.size, 0);
  assert.equal(cache.get('a'), undefined);
});

test('the cap is never exceeded, however many distinct keys arrive', () => {
  const cache = new LruCache<number, number>(3, 60_000);
  for (let i = 0; i < 50; i += 1) cache.set(i, i);

  assert.equal(cache.size, 3);
  assert.equal(cache.get(49), 49);
  assert.equal(cache.get(0), undefined);
});
