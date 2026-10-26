import { Injectable, Logger } from '@nestjs/common';
import { SOCRATA_DOMAIN } from '@nyc-atlas/shared';
import { AppConfig } from '../config/configuration.js';

export interface SoqlQuery {
  select?: string;
  where?: string;
  group?: string;
  order?: string;
  limit?: number;
  offset?: number;
  /**
   * Socrata host, when the dataset does not live on NYC Open Data. Food retail
   * is State-licensed, so its inventory is on data.ny.gov; the API is identical.
   * Pass `DATASETS.x.domain` straight through.
   */
  domain?: string;
}

/** Socrata caps a single page at 50,000 rows. */
export const SOCRATA_MAX_PAGE = 50_000;

/** Worth retrying. Any other 4xx is a bug in our query, not a blip. */
function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
}

@Injectable()
export class SocrataService {
  private readonly logger = new Logger(SocrataService.name);
  private readonly retry: RetryOptions = { attempts: 4, baseDelayMs: 500 };

  constructor(private readonly config: AppConfig) {}

  private headers(): Record<string, string> {
    const token = this.config.socrataAppToken;
    return token ? { 'X-App-Token': token } : {};
  }

  private buildUrl(datasetId: string, query: SoqlQuery, format: 'json' | 'geojson'): string {
    const params = new URLSearchParams();
    if (query.select) params.set('$select', query.select);
    if (query.where) params.set('$where', query.where);
    if (query.group) params.set('$group', query.group);
    if (query.order) params.set('$order', query.order);
    if (query.limit !== undefined) params.set('$limit', String(query.limit));
    if (query.offset !== undefined) params.set('$offset', String(query.offset));
    const domain = query.domain ?? SOCRATA_DOMAIN;
    return `https://${domain}/resource/${datasetId}.${format}?${params.toString()}`;
  }

  private async fetchWithRetry(url: string): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.retry.attempts; attempt += 1) {
      try {
        const res = await fetch(url, { headers: this.headers() });
        if (isTransientStatus(res.status)) {
          throw new Error(`HTTP ${res.status}`);
        }
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
        }
        return res;
      } catch (err) {
        lastError = err;
        if (attempt === this.retry.attempts) break;
        const delay = this.retry.baseDelayMs * 2 ** (attempt - 1);
        this.logger.warn(`Socrata attempt ${attempt} failed (${String(err)}); retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error(`Socrata request failed after ${this.retry.attempts} attempts: ${String(lastError)}`);
  }

  async query<T>(datasetId: string, query: SoqlQuery = {}): Promise<T[]> {
    const url = this.buildUrl(datasetId, query, 'json');
    const res = await this.fetchWithRetry(url);
    return (await res.json()) as T[];
  }

  async queryGeoJson(datasetId: string, query: SoqlQuery = {}): Promise<GeoJsonFeatureCollection> {
    const url = this.buildUrl(datasetId, query, 'geojson');
    const res = await this.fetchWithRetry(url);
    return (await res.json()) as GeoJsonFeatureCollection;
  }

  /** Pages through a dataset. Yields batches so callers can stream-aggregate. */
  async *paginate<T>(
    datasetId: string,
    query: Omit<SoqlQuery, 'limit' | 'offset'>,
    pageSize = SOCRATA_MAX_PAGE,
  ): AsyncGenerator<T[], void, undefined> {
    let offset = 0;
    for (;;) {
      const page = await this.query<T>(datasetId, { ...query, limit: pageSize, offset });
      if (page.length === 0) return;
      yield page;
      if (page.length < pageSize) return;
      offset += pageSize;
    }
  }

  async count(datasetId: string, where?: string): Promise<number> {
    const rows = await this.query<{ n: string }>(datasetId, {
      select: 'count(1) as n',
      ...(where ? { where } : {}),
    });
    return Number(rows[0]?.n ?? 0);
  }

  async metadata(datasetId: string, domain: string = SOCRATA_DOMAIN): Promise<SocrataMetadata> {
    const url = `https://${domain}/api/views/${datasetId}.json`;
    const res = await this.fetchWithRetry(url);
    return (await res.json()) as SocrataMetadata;
  }
}

export interface SocrataMetadata {
  id: string;
  name: string;
  rowsUpdatedAt?: number;
  columns?: { fieldName: string; dataTypeName: string }[];
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export interface GeoJsonFeature {
  type: 'Feature';
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, string | number | null>;
}
