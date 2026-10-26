import type { QualityRejection } from '../../store/atlasApi.js';

/**
 * Shapes the ingest's rejection list for display (specs/008 §7.3).
 *
 * Rows are dropped for many reasons across several datasets, and a flat list
 * of twenty entries reads as noise. Grouping by dataset answers the question a
 * reader actually has — which source lost rows, and to what — while the total
 * keeps the overall scale of the loss in view.
 */

export interface DatasetRejections {
  dataset: string;
  total: number;
  reasons: { reason: string; count: number }[];
}

export interface RejectionSummary {
  totalDropped: number;
  byDataset: DatasetRejections[];
}

/** Largest loss first, at both levels: the biggest problem should be read first. */
export function summarizeRejections(rejections: readonly QualityRejection[]): RejectionSummary {
  const grouped = new Map<string, DatasetRejections>();

  for (const rejection of rejections) {
    let entry = grouped.get(rejection.dataset);
    if (!entry) {
      entry = { dataset: rejection.dataset, total: 0, reasons: [] };
      grouped.set(rejection.dataset, entry);
    }
    entry.total += rejection.count;
    entry.reasons.push({ reason: rejection.reason, count: rejection.count });
  }

  const byDataset = [...grouped.values()].sort((a, b) => b.total - a.total);
  for (const entry of byDataset) {
    entry.reasons.sort((a, b) => b.count - a.count);
  }

  return {
    totalDropped: rejections.reduce((sum, r) => sum + r.count, 0),
    byDataset,
  };
}

/**
 * The share of processed rows that survived, as a percentage string.
 *
 * Stated as a retention rate rather than a loss rate because the honest
 * headline is how much of the data the analysis actually rests on.
 */
export function retentionRate(totalRowsProcessed: number, totalDropped: number): string | null {
  if (totalRowsProcessed <= 0) return null;
  const kept = Math.max(0, totalRowsProcessed - totalDropped);
  return `${((kept / totalRowsProcessed) * 100).toFixed(1)}%`;
}
