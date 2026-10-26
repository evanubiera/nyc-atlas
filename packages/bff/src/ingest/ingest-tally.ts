import type { QualityReport } from './ingest.types.js';

export interface IncidentBatchResult {
  totalRows: number;
  recoveredViaFallback: number;
  coordinatesSwapped: number;
  rejected: Map<string, number>;
  unmappedOffenses?: Iterable<string>;
}

/**
 * Each stage adds its own rows, repairs and rejections; collecting them in one
 * place is what lets the quality report state exactly what was dropped and why,
 * rather than leaving the losses invisible.
 */
export class IngestTally {
  readonly rejections: QualityReport['rejections'] = [];
  readonly notes: string[] = [];
  private readonly unmappedOffenses = new Set<string>();

  totalRows = 0;
  recoveredViaFallback = 0;
  coordinatesRepaired = 0;

  absorbIncidents(datasetId: string, result: IncidentBatchResult): void {
    this.totalRows += result.totalRows;
    this.recoveredViaFallback += result.recoveredViaFallback;
    this.coordinatesRepaired += result.coordinatesSwapped;
    this.absorbRejections(datasetId, result.rejected);

    for (const offense of result.unmappedOffenses ?? []) this.unmappedOffenses.add(offense);
  }

  absorbRejections(datasetId: string, rejected: ReadonlyMap<string, number>): void {
    for (const [reason, count] of rejected) {
      this.rejections.push({ dataset: datasetId, reason, count });
    }
  }

  note(...lines: string[]): void {
    this.notes.push(...lines);
  }

  get unmapped(): string[] {
    return [...this.unmappedOffenses].sort();
  }

  toQualityReport(): QualityReport {
    return {
      generatedAt: new Date().toISOString(),
      totalRowsProcessed: this.totalRows,
      rejections: [...this.rejections].sort((a, b) => b.count - a.count),
      unmappedOffenses: this.unmapped,
      recoveredViaFallback: this.recoveredViaFallback,
      coordinatesRepaired: this.coordinatesRepaired,
      notes: this.notes,
    };
  }
}
