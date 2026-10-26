import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service.js';
import type { IngestOutcome, ResumeHooks } from '../incidents/incidents.service.js';
import {
  advance,
  clearDataset,
  deserializeOutcome,
  isResumable,
  type ResumeState,
} from './resume-log.js';
import { SOCRATA_MAX_PAGE } from '../socrata/socrata.service.js';

/** Not a data cache — progress for a run in flight, and gitignored. */
export const RESUME_FILE = 'ingest-resume.json';

/**
 * Persists ingest progress so an interrupted run continues (specs/008 §1.10).
 *
 * Checkpointing every page would write the whole partial aggregate 200 times
 * over a complaint ingest. Every tenth page bounds the rewritten bytes while
 * capping the worst-case loss at ten pages, which is minutes rather than the
 * hour a full restart costs.
 */
const CHECKPOINT_EVERY_PAGES = 10;

@Injectable()
export class ResumeService implements ResumeHooks {
  private readonly logger = new Logger(ResumeService.name);
  private state: ResumeState = {};
  private pagesSinceWrite = 0;

  constructor(private readonly cache: CacheService) {}

  async load(): Promise<void> {
    this.state = (await this.cache.read<ResumeState>(RESUME_FILE)) ?? {};
    const pending = Object.keys(this.state);
    if (pending.length > 0) {
      this.logger.warn(`Found an interrupted ingest; resuming ${pending.join(', ')}`);
    }
  }

  restore(datasetId: string): { nextOffset: number; outcome: IngestOutcome } | null {
    const checkpoint = this.state[datasetId];
    if (!isResumable(checkpoint, SOCRATA_MAX_PAGE)) return null;

    return {
      nextOffset: checkpoint.nextOffset,
      outcome: deserializeOutcome(checkpoint.outcome),
    };
  }

  async checkpoint(datasetId: string, nextOffset: number, outcome: IngestOutcome): Promise<void> {
    this.state = advance(this.state, datasetId, nextOffset, outcome);
    this.pagesSinceWrite += 1;

    if (this.pagesSinceWrite < CHECKPOINT_EVERY_PAGES) return;
    this.pagesSinceWrite = 0;
    await this.cache.write(RESUME_FILE, this.state);
  }

  async complete(datasetId: string): Promise<void> {
    this.state = clearDataset(this.state, datasetId);
    this.pagesSinceWrite = 0;
    await this.cache.write(RESUME_FILE, this.state);
  }

  /** Called once the whole run has written its caches; nothing is left to resume. */
  async finish(): Promise<void> {
    this.state = {};
    await this.cache.write(RESUME_FILE, this.state);
  }
}
