import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retentionRate, summarizeRejections } from './qualityReport.ts';

const REJECTIONS = [
  { dataset: 'institutions', reason: 'duplicate across DCLA and FacDB', count: 1738 },
  { dataset: 'amenities', reason: 'food stores: licence has no georeference', count: 227 },
  { dataset: 'institutions', reason: 'FacDB: missing coordinates', count: 429 },
  { dataset: 'amenities', reason: 'store grades: no georeference', count: 86 },
];

test('rejections group by dataset, largest loss first', () => {
  const summary = summarizeRejections(REJECTIONS);

  assert.deepEqual(
    summary.byDataset.map((d) => d.dataset),
    ['institutions', 'amenities'],
  );
  assert.equal(summary.byDataset[0]?.total, 2167);
  assert.equal(summary.byDataset[1]?.total, 313);
});

test('reasons within a dataset are ordered by how much they cost', () => {
  const [institutions] = summarizeRejections(REJECTIONS).byDataset;

  assert.deepEqual(
    institutions?.reasons.map((r) => r.count),
    [1738, 429],
  );
});

test('the total counts every rejection, not just the grouped head', () => {
  assert.equal(summarizeRejections(REJECTIONS).totalDropped, 2480);
});

test('an ingest that dropped nothing summarizes to zero rather than failing', () => {
  const summary = summarizeRejections([]);

  assert.equal(summary.totalDropped, 0);
  assert.deepEqual(summary.byDataset, []);
});

test('retention is stated as the share kept', () => {
  assert.equal(retentionRate(1000, 100), '90.0%');
  assert.equal(retentionRate(1_000_000, 2480), '99.8%');
});

test('retention is withheld rather than invented when nothing was processed', () => {
  assert.equal(retentionRate(0, 0), null);
});

test('more dropped than processed cannot report a negative retention', () => {
  assert.equal(retentionRate(100, 500), '0.0%');
});
