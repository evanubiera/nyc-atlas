import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CacheService } from '../cache/cache.service.js';
import { CACHE_FILES, type ProvenanceCache } from '../ingest/ingest.types.js';

/**
 * Serves the freshness sidecar the ingest writes (specs/008 §3.4).
 *
 * Read once at boot rather than per request: it changes only when an ingest
 * runs, and the resolver is asked for it on every page load. Absent entirely
 * before the first ingest, which reports as nulls rather than as an error —
 * the app is expected to run against committed caches.
 */
@Injectable()
export class ProvenanceService implements OnModuleInit {
  private readonly logger = new Logger(ProvenanceService.name);
  private cached: ProvenanceCache | null = null;

  constructor(private readonly cache: CacheService) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.cached = await this.cache.read<ProvenanceCache>(CACHE_FILES.provenance);
    if (this.cached === null) {
      this.logger.warn('No provenance sidecar yet — run `npm run ingest` to record freshness');
    }
  }

  get generatedAt(): string | null {
    return this.cached?.generatedAt ?? null;
  }

  freshnessOf(datasetId: string): { rowsUpdatedAt: string | null; rowCount: number | null } {
    return this.cached?.datasets[datasetId] ?? { rowsUpdatedAt: null, rowCount: null };
  }
}
