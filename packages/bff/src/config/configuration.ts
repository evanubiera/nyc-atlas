import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Typed access to configuration. Every key is optional by design — the app must
 * run with no credentials at all (specs/001 NFR-4, NFR-5).
 */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService) {}

  get port(): number {
    return Number(this.config.get('PORT') ?? 4000);
  }

  /** Raises Socrata rate limits. Optional. */
  get socrataAppToken(): string | null {
    return this.config.get<string>('SOCRATA_APP_TOKEN')?.trim() || null;
  }

  /**
   * Required for live ACS demographics. The Census API rejects unkeyed requests
   * (302 -> missing_key.html, verified 2026-10-24). Absent, demographic features
   * degrade to the committed cache rather than failing startup.
   */
  get censusApiKey(): string | null {
    return this.config.get<string>('CENSUS_API_KEY')?.trim() || null;
  }

  get hasCensusKey(): boolean {
    return this.censusApiKey !== null;
  }

  get isProduction(): boolean {
    return this.config.get('NODE_ENV') === 'production';
  }

  /**
   * Where the ingest caches live.
   *
   * Defaults to the repo layout for local work. In a container the path is
   * whatever the image puts it at, and resolving it from the working directory
   * would make the process depend on how it was launched.
   */
  get cacheDir(): string | null {
    return this.config.get<string>('CACHE_DIR')?.trim() || null;
  }

  /**
   * Origins allowed to call the API.
   *
   * Comma-separated. Empty means reflect the caller's origin, which is
   * convenient locally and wrong in production — so production without an
   * allowlist is refused at startup rather than served permissively.
   */
  get corsOrigins(): string[] {
    const raw = this.config.get<string>('CORS_ORIGINS')?.trim();
    return raw ? raw.split(',').map((origin) => origin.trim()).filter(Boolean) : [];
  }

  /** Stamped into the image by CI; surfaced on /healthz so a deploy is identifiable. */
  get revision(): string {
    return this.config.get<string>('GIT_SHA')?.trim() || 'unknown';
  }
}
