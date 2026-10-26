/**
 * Counts rows an ingest stage refused, keyed by the reason.
 *
 * Every stage discards rows, and a count that nobody can see is a silent data
 * loss. The ingest quality report is built from these.
 */
export class RejectionLog {
  private readonly counts = new Map<string, number>();

  record(reason: string): void {
    this.counts.set(reason, (this.counts.get(reason) ?? 0) + 1);
  }

  countOf(reason: string): number {
    return this.counts.get(reason) ?? 0;
  }

  get total(): number {
    let total = 0;
    for (const count of this.counts.values()) total += count;
    return total;
  }

  toMap(): Map<string, number> {
    return new Map(this.counts);
  }

  absorb(other: RejectionLog): void {
    for (const [reason, count] of other.counts) {
      this.counts.set(reason, (this.counts.get(reason) ?? 0) + count);
    }
  }
}
