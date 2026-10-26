import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advance,
  clearDataset,
  deserializeOutcome,
  isResumable,
  serializeOutcome,
} from './resume-log.js';
import type { IngestOutcome } from '../incidents/incidents.service.js';

function outcome(over: Partial<IngestOutcome> = {}): IngestOutcome {
  return {
    aggregate: { BK01: { SHOOTING: { '2024-01': 3 } } },
    totalRows: 100,
    accepted: 90,
    rejected: new Map([['missing date', 7], ['outside NYC', 3]]),
    unmappedOffenses: new Set(['NEW OFFENSE']),
    recoveredViaFallback: 4,
    coordinatesSwapped: 80,
    ...over,
  };
}

test('a partial tally survives the round trip, Maps and Sets included', () => {
  const restored = deserializeOutcome(serializeOutcome(outcome()));

  assert.equal(restored.totalRows, 100);
  assert.equal(restored.accepted, 90);
  assert.equal(restored.rejected.get('missing date'), 7);
  assert.ok(restored.unmappedOffenses.has('NEW OFFENSE'));
  assert.equal(restored.coordinatesSwapped, 80);
  assert.deepEqual(restored.aggregate, { BK01: { SHOOTING: { '2024-01': 3 } } });
});

test('serialization is ordered, so a checkpoint file stays stable', () => {
  const a = serializeOutcome(outcome());
  const b = serializeOutcome(
    outcome({ rejected: new Map([['outside NYC', 3], ['missing date', 7]]) }),
  );

  assert.deepEqual(a.rejected, b.rejected);
});

test('a checkpoint on a page boundary resumes', () => {
  assert.equal(isResumable({ nextOffset: 100_000, outcome: serializeOutcome(outcome()) }, 50_000), true);
});

test('a checkpoint from a different page size is discarded, not landed mid-page', () => {
  assert.equal(isResumable({ nextOffset: 30_000, outcome: serializeOutcome(outcome()) }, 50_000), false);
});

test('a missing or zero checkpoint simply starts from the beginning', () => {
  assert.equal(isResumable(undefined, 50_000), false);
  assert.equal(isResumable({ nextOffset: 0, outcome: serializeOutcome(outcome()) }, 50_000), false);
});

test('advancing records the offset and the tally together', () => {
  const state = advance({}, '5ucz-vwe8', 50_000, outcome());

  assert.equal(state['5ucz-vwe8']?.nextOffset, 50_000);
  assert.equal(state['5ucz-vwe8']?.outcome.accepted, 90);
});

test('advancing leaves other datasets untouched', () => {
  const first = advance({}, 'a', 50_000, outcome());
  const second = advance(first, 'b', 100_000, outcome());

  assert.equal(second['a']?.nextOffset, 50_000);
  assert.equal(second['b']?.nextOffset, 100_000);
});

test('a finished dataset is cleared, so the next run does not resume a complete read', () => {
  const state = clearDataset(advance({}, 'a', 50_000, outcome()), 'a');

  assert.equal(state['a'], undefined);
  assert.equal(isResumable(state['a'], 50_000), false);
});
