import { Injectable, Logger } from '@nestjs/common';
import {
  DATASETS,
  EARLIEST_VALID_INCIDENT_DATE,
  classifyOffense,
  resolveCoordinatePair,
  type CrimeCategory,
  type Nta2020Code,
} from '@nyc-atlas/shared';
import { OFFENSE_TO_CATEGORY } from '@nyc-atlas/shared';
import { SocrataService } from '../socrata/socrata.service.js';
import { GeographyService } from '../geography/geography.service.js';
import {
  buildBboxWhere,
  isBboxServiceable,
  MAX_INCIDENT_POINTS,
  toPointsWithinBbox,
  type BoundingBox,
  type IncidentPoint,
} from './incident-points.js';

/** nta2020 -> category -> 'YYYY-MM' -> count */
export type IncidentAggregate = Record<string, Record<string, Record<string, number>>>;

/**
 * How a caller persists progress. Passed in rather than depended on, so the
 * ingest stays testable and a run can opt out of checkpointing entirely.
 */
export interface ResumeHooks {
  restore(datasetId: string): { nextOffset: number; outcome: IngestOutcome } | null;
  checkpoint(datasetId: string, nextOffset: number, outcome: IngestOutcome): Promise<void>;
  complete(datasetId: string): Promise<void>;
}

export interface IngestOutcome {
  aggregate: IncidentAggregate;
  totalRows: number;
  accepted: number;
  rejected: Map<string, number>;
  unmappedOffenses: Set<string>;
  /** Rows that resolved a category only via the pd_desc fallback. */
  recoveredViaFallback: number;
  /** Rows whose latitude/longitude columns arrived transposed. */
  coordinatesSwapped: number;
}

interface ShootingRow {
  occur_date?: string;
  latitude?: string;
  longitude?: string;
}

interface ComplaintRow {
  cmplnt_fr_dt?: string;
  ofns_desc?: string;
  pd_desc?: string;
  law_cat_cd?: string;
  latitude?: string;
  longitude?: string;
}

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    private readonly socrata: SocrataService,
    private readonly geography: GeographyService,
  ) {}

  /**
   * Shootings — the primary outcome.
   *
   * Least affected by reporting bias: a gunshot wound reaches a hospital and a
   * police response regardless of the victim's trust in the NYPD. For a project
   * about marginalized neighborhoods, where under-reporting is worst, this is
   * the measure that holds up. See specs/007 §3.
   */
  async ingestShootings(resume?: ResumeHooks): Promise<IngestOutcome> {
    const datasetId = DATASETS.shootings.id;
    const restored = resume?.restore(datasetId);
    const outcome = restored?.outcome ?? emptyOutcome();
    const startOffset = restored?.nextOffset ?? 0;

    this.logger.log(
      startOffset > 0
        ? `Resuming shootings from row ${startOffset.toLocaleString()}…`
        : 'Ingesting shootings (2006–present)…',
    );

    for await (const { rows: page, nextOffset } of this.socrata.paginate<ShootingRow>(
      datasetId,
      { select: 'occur_date, latitude, longitude', order: 'occur_date' },
      undefined,
      startOffset,
    )) {
      for (const row of page) {
        outcome.totalRows += 1;
        const placed = this.place(row.longitude, row.latitude, row.occur_date, outcome);
        if (placed === null) continue;
        bumpAggregate(outcome.aggregate, placed.nta, 'SHOOTING', placed.month);
        outcome.accepted += 1;
      }
      await resume?.checkpoint(datasetId, nextOffset, outcome);
    }

    await resume?.complete(datasetId);
    this.logSummary('shootings', outcome);
    return outcome;
  }

  /**
   * Complaints — the secondary outcome, carrying reporting bias that is itself
   * correlated with the exposure of interest.
   */
  async ingestComplaints(
    datasetId: string,
    label: string,
    resume?: ResumeHooks,
  ): Promise<IngestOutcome> {
    const restored = resume?.restore(datasetId);
    const outcome = restored?.outcome ?? emptyOutcome();
    const startOffset = restored?.nextOffset ?? 0;

    this.logger.log(
      startOffset > 0
        ? `Resuming complaints (${label}) from row ${startOffset.toLocaleString()}…`
        : `Ingesting complaints (${label})…`,
    );

    for await (const { rows: page, nextOffset } of this.socrata.paginate<ComplaintRow>(
      datasetId,
      {
        select: 'cmplnt_fr_dt, ofns_desc, pd_desc, law_cat_cd, latitude, longitude',
        order: 'cmplnt_fr_dt',
      },
      undefined,
      startOffset,
    )) {
      for (const row of page) {
        outcome.totalRows += 1;
        const placed = this.place(row.longitude, row.latitude, row.cmplnt_fr_dt, outcome);
        if (placed === null) continue;

        const cls = classifyOffense(row.ofns_desc, row.pd_desc);
        if (cls.unmapped && row.ofns_desc !== undefined) {
          outcome.unmappedOffenses.add(row.ofns_desc);
        }
        if (cls.viaFallback) outcome.recoveredViaFallback += 1;

        bumpAggregate(outcome.aggregate, placed.nta, cls.category, placed.month);
        outcome.accepted += 1;
      }
      await resume?.checkpoint(datasetId, nextOffset, outcome);
    }

    await resume?.complete(datasetId);
    this.logSummary(`complaints (${label})`, outcome);
    return outcome;
  }

  /**
   * Point-level incidents inside a viewport (specs/008 §3.5).
   *
   * Nothing stores these: the ingest aggregates to NTA and month, so the only
   * source of points is upstream. Both bounds are load-bearing — the bbox
   * keeps the query small enough to answer, and the row cap keeps one
   * pathological request from stalling the process.
   *
   * Returns `capped` so the client can say the view is partial rather than
   * drawing a sample as if it were the whole.
   */
  async fetchPoints(params: {
    bbox: BoundingBox;
    category: CrimeCategory;
    from: string;
    to: string;
    limit?: number;
  }): Promise<{ points: IncidentPoint[]; capped: boolean }> {
    const { bbox, category, from, to } = params;
    const limit = Math.min(params.limit ?? MAX_INCIDENT_POINTS, MAX_INCIDENT_POINTS);

    if (!isBboxServiceable(bbox)) return { points: [], capped: false };

    const isShooting = category === 'SHOOTING';
    const dataset = isShooting ? DATASETS.shootings : DATASETS.complaintsCurrent;
    const dateColumn = isShooting ? 'occur_date' : 'cmplnt_fr_dt';

    let where = buildBboxWhere(bbox, dateColumn, from, to);
    if (!isShooting) {
      const labels = offenseLabelsFor(category);
      if (labels.length === 0) return { points: [], capped: false };
      where += ` and ofns_desc in (${labels.map(quoteSoql).join(',')})`;
    }

    const rows = await this.socrata.query<ShootingRow & ComplaintRow>(dataset.id, {
      select: `latitude, longitude, ${dateColumn}`,
      where,
      limit,
    });

    const points = toPointsWithinBbox(rows, bbox, (row) =>
      isShooting ? (row as ShootingRow).occur_date : (row as ComplaintRow).cmplnt_fr_dt,
    );

    return { points, capped: rows.length >= limit };
  }

  /**
   * Validates a row and resolves it to an NTA and a month bucket.
   * Returns null for any row that cannot be trusted, recording why.
   *
   * Column order cannot be trusted: 98.7% of Shootings rows ship with latitude
   * and longitude transposed. `resolveCoordinatePair` recovers them by range,
   * which is unambiguous because NYC's latitude and longitude bands do not
   * overlap. Offense labels are frequently the literal '(null)', which the
   * pd_desc fallback inside `classifyOffense` recovers.
   */
  private place(
    lonRaw: string | undefined,
    latRaw: string | undefined,
    dateRaw: string | undefined,
    outcome: IngestOutcome,
  ): { nta: Nta2020Code; month: string } | null {
    const bump = (reason: string): null => {
      outcome.rejected.set(reason, (outcome.rejected.get(reason) ?? 0) + 1);
      return null;
    };

    const resolved = resolveCoordinatePair(Number(latRaw), Number(lonRaw));
    if (resolved === null) return bump('coordinates missing, (0,0), or outside the NYC bounding box');
    const { lon, lat } = resolved;
    if (resolved.wasSwapped) outcome.coordinatesSwapped += 1;

    if (dateRaw === undefined || dateRaw === '') return bump('missing date');
    const iso = dateRaw.slice(0, 10);
    if (iso < EARLIEST_VALID_INCIDENT_DATE) return bump('date before 2006 (data-entry error)');
    if (iso > new Date().toISOString().slice(0, 10)) return bump('date in the future');

    const nta = this.geography.resolvePoint(lon, lat);
    if (nta === null) return bump('point fell outside every NTA polygon');

    return { nta, month: iso.slice(0, 7) };
  }

  private logSummary(label: string, o: IngestOutcome): void {
    const pct = o.totalRows === 0 ? 0 : (100 * o.accepted) / o.totalRows;
    this.logger.log(
      `${label}: ${o.accepted.toLocaleString()} / ${o.totalRows.toLocaleString()} accepted (${pct.toFixed(1)}%)`,
    );
    for (const [reason, n] of [...o.rejected].sort((a, b) => b[1] - a[1])) {
      this.logger.warn(`   rejected ${n.toLocaleString()} — ${reason}`);
    }
    if (o.coordinatesSwapped > 0) {
      this.logger.warn(
        `   repaired ${o.coordinatesSwapped.toLocaleString()} rows with transposed ` +
          `latitude/longitude columns`,
      );
    }
    if (o.recoveredViaFallback > 0) {
      this.logger.log(
        `   recovered ${o.recoveredViaFallback.toLocaleString()} rows via pd_desc fallback`,
      );
    }
    if (o.unmappedOffenses.size > 0) {
      this.logger.error(`   UNMAPPED offense labels: ${[...o.unmappedOffenses].join(', ')}`);
    }
  }
}

function emptyOutcome(): IngestOutcome {
  return {
    aggregate: {},
    totalRows: 0,
    accepted: 0,
    rejected: new Map(),
    unmappedOffenses: new Set(),
    recoveredViaFallback: 0,
    coordinatesSwapped: 0,
  };
}

function bumpAggregate(
  agg: IncidentAggregate,
  nta: string,
  category: CrimeCategory,
  month: string,
): void {
  const byCategory = (agg[nta] ??= {});
  const byMonth = (byCategory[category] ??= {});
  byMonth[month] = (byMonth[month] ?? 0) + 1;
}

export function mergeAggregates(a: IncidentAggregate, b: IncidentAggregate): IncidentAggregate {
  const out: IncidentAggregate = structuredClone(a);
  for (const [nta, cats] of Object.entries(b)) {
    for (const [cat, months] of Object.entries(cats)) {
      for (const [month, n] of Object.entries(months)) {
        const byCat = (out[nta] ??= {});
        const byMonth = (byCat[cat] ??= {});
        byMonth[month] = (byMonth[month] ?? 0) + n;
      }
    }
  }
  return out;
}

/** The raw upstream labels that map to one analysis category. */
function offenseLabelsFor(category: CrimeCategory): string[] {
  return Object.entries(OFFENSE_TO_CATEGORY)
    .filter(([, mapped]) => mapped === category)
    .map(([label]) => label);
}

/** SoQL escapes a single quote by doubling it; several offense labels contain one. */
function quoteSoql(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
