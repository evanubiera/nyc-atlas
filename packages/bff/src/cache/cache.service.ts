import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** The ingest runs from packages/bff, so the repo root is two levels up. */
const CACHE_DIR_FROM_BFF_PACKAGE = '../../data/cache';

/**
 * Disk cache for ingest output.
 *
 * Writes are deterministic: keys are sorted before serialisation so repeated
 * ingests of the same upstream data produce byte-identical files (specs/001
 * NFR-11). Timestamps live in a separate provenance file so they cannot make
 * the data payload unstable.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly root: string;

  constructor() {
    this.root = resolve(process.cwd(), CACHE_DIR_FROM_BFF_PACKAGE);
  }

  path(name: string): string {
    return join(this.root, name);
  }

  has(name: string): boolean {
    return existsSync(this.path(name));
  }

  async read<T>(name: string): Promise<T | null> {
    const file = this.path(name);
    if (!existsSync(file)) return null;
    try {
      return JSON.parse(await readFile(file, 'utf8')) as T;
    } catch (err) {
      this.logger.error(`Cache file ${name} is unreadable: ${String(err)}`);
      return null;
    }
  }

  async write(name: string, payload: unknown): Promise<void> {
    const file = this.path(name);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, serializeCache(payload), 'utf8');
    this.logger.log(`Wrote ${name}`);
  }
}

/**
 * The canonical on-disk form (NFR-11).
 *
 * Exported so the determinism contract can be tested directly and checked
 * against the committed caches, rather than inferred from running an ingest
 * twice against live APIs.
 */
export function serializeCache(payload: unknown): string {
  return JSON.stringify(sortDeep(payload), null, 2) + '\n';
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return Object.fromEntries(entries.map(([k, v]) => [k, sortDeep(v)]));
  }
  return value;
}
