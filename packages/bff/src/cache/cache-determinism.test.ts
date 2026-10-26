import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { serializeCache } from './cache.service.js';

/**
 * NFR-11: the same upstream data must produce byte-identical caches.
 *
 * Running the ingest twice would prove it end to end but needs the network and
 * tens of minutes, so the contract is tested where it actually lives — the
 * serializer — and then enforced against every committed cache file, which is
 * the artifact the claim is really about.
 */

test('key order in the input cannot change the bytes on disk', () => {
  const a = { beta: 1, alpha: { z: 1, a: 2 } };
  const b = { alpha: { a: 2, z: 1 }, beta: 1 };

  assert.equal(serializeCache(a), serializeCache(b));
});

test('array order is data and is never sorted away', () => {
  const months = { counts: [3, 1, 2] };

  assert.match(serializeCache(months), /\[\s*3,\s*1,\s*2\s*\]/);
});

test('serializing the same payload twice is byte-identical', () => {
  const payload = { byNta: { BK01: { rate: 1.5 }, QN02: { rate: 2.5 } } };

  assert.equal(serializeCache(payload), serializeCache(payload));
});

test('the file ends in exactly one newline, so diffs stay clean', () => {
  const output = serializeCache({ a: 1 });

  assert.ok(output.endsWith('}\n'));
  assert.ok(!output.endsWith('\n\n'));
});

test('nulls survive rather than being dropped into undefined', () => {
  assert.match(serializeCache({ population: null }), /"population": null/);
});

test('every committed cache file is already in canonical form', () => {
  // If an ingest ever wrote a file some other way, re-serializing it here
  // produces different bytes — which is exactly the drift NFR-11 forbids.
  const dir = path.resolve(process.cwd(), '../../data/cache');
  const files = readdirSync(dir).filter((name) => name.endsWith('.json'));

  assert.ok(files.length > 0, 'no cache files found to check');

  for (const name of files) {
    const onDisk = readFileSync(path.join(dir, name), 'utf8');
    const canonical = serializeCache(JSON.parse(onDisk));
    assert.equal(canonical, onDisk, `${name} is not in canonical form`);
  }
});
