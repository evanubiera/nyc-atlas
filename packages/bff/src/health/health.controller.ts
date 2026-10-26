import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GeographyService } from '../geography/geography.service.js';
import { MetricsService } from '../metrics/metrics.service.js';
import { AppConfig } from '../config/configuration.js';

/**
 * Liveness and readiness, kept apart because they answer different questions
 * and an orchestrator acts on them differently.
 *
 * This service boots degraded rather than failing: if the NTA geometry cannot
 * be fetched, it logs and carries on serving empty results. That is right for
 * a laptop and wrong behind a load balancer, where a pod that answers but has
 * no geography silently returns a map of nothing. Readiness is what keeps
 * traffic away from it until it can actually answer.
 */
@Controller()
export class HealthController {
  constructor(
    private readonly geography: GeographyService,
    private readonly metrics: MetricsService,
    private readonly config: AppConfig,
  ) {}

  /**
   * Liveness: is the process healthy enough to keep, or should it be
   * restarted? Deliberately not tied to upstream state — restarting a pod
   * does not fix Socrata being down, and a liveness probe that fails during
   * an outage turns a degraded service into a crash loop.
   */
  @Get('healthz')
  live(): { status: string; revision: string; uptimeSeconds: number } {
    return {
      status: 'ok',
      revision: this.config.revision,
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  /**
   * Readiness: should this instance receive traffic right now?
   *
   * Geometry is required — without it every spatial answer is empty. Missing
   * demographics are not: degrading to area density with a visible caveat is
   * a designed behaviour (NFR-5), not an outage.
   */
  @Get('readyz')
  ready(@Res() response: Response): void {
    const checks = {
      geographyLoaded: this.geography.isLoaded,
      ingestCachePresent: this.metrics.hasData,
    };
    const ready = Object.values(checks).every(Boolean);

    response
      .status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json({ status: ready ? 'ready' : 'not-ready', checks });
  }
}
