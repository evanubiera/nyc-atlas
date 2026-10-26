import type { IncidentAggregate, IngestOutcome } from '../incidents/incidents.service.js';

/**
 * Checkpointing for the paged incident ingest (specs/008 §1.10).
 *
 * The complaint file is ten million rows over two hundred pages. A failure at
 * page 180 previously threw away everything and started again, which on a
 * rate-limited API is an hour lost to a transient 503.
 *
 * Resuming is only sound because both loops page with an explicit `$order`:
 * without a stable sort, offset 150,000 is not the same hundred rows on the
 * next run, and a resumed ingest would silently double-count some rows and
 * skip others.
 *
 * The partial tally travels with the offset. An offset alone would resume the
 * reading and lose every count accumulated before the failure.
 */

/** Maps and Sets do not survive JSON, so they are stored as entries. */
export interface SerializedOutcome {
  aggregate: IncidentAggregate;
  totalRows: number;
  accepted: number;
  rejected: [string, number][];
  unmappedOffenses: string[];
  recoveredViaFallback: number;
  coordinatesSwapped: number;
}

export interface IngestCheckpoint {
  /** The offset to resume reading from — the first row not yet counted. */
  nextOffset: number;
  outcome: SerializedOutcome;
}

export type ResumeState = Record<string, IngestCheckpoint>;

export function serializeOutcome(outcome: IngestOutcome): SerializedOutcome {
  return {
    aggregate: outcome.aggregate,
    totalRows: outcome.totalRows,
    accepted: outcome.accepted,
    rejected: [...outcome.rejected.entries()].sort(([a], [b]) => (a < b ? -1 : 1)),
    unmappedOffenses: [...outcome.unmappedOffenses].sort(),
    recoveredViaFallback: outcome.recoveredViaFallback,
    coordinatesSwapped: outcome.coordinatesSwapped,
  };
}

export function deserializeOutcome(stored: SerializedOutcome): IngestOutcome {
  return {
    aggregate: stored.aggregate,
    totalRows: stored.totalRows,
    accepted: stored.accepted,
    rejected: new Map(stored.rejected),
    unmappedOffenses: new Set(stored.unmappedOffenses),
    recoveredViaFallback: stored.recoveredViaFallback,
    coordinatesSwapped: stored.coordinatesSwapped,
  };
}

/**
 * A checkpoint is only usable when it matches the page size the run is using.
 *
 * Resuming a 50,000-row checkpoint with a 10,000-row page would land
 * mid-page, so a changed page size discards the checkpoint rather than
 * producing a subtly wrong total.
 */
export function isResumable(
  checkpoint: IngestCheckpoint | undefined,
  pageSize: number,
): checkpoint is IngestCheckpoint {
  if (!checkpoint) return false;
  if (!Number.isInteger(checkpoint.nextOffset) || checkpoint.nextOffset <= 0) return false;
  return checkpoint.nextOffset % pageSize === 0;
}

export function advance(
  state: ResumeState,
  datasetId: string,
  nextOffset: number,
  outcome: IngestOutcome,
): ResumeState {
  return { ...state, [datasetId]: { nextOffset, outcome: serializeOutcome(outcome) } };
}

/** Dropped on success, so the next run is not tempted to resume a finished read. */
export function clearDataset(state: ResumeState, datasetId: string): ResumeState {
  const next = { ...state };
  delete next[datasetId];
  return next;
}
