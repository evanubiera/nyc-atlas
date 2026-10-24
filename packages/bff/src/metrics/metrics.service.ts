import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CRIME_CATEGORY_META,
  MIN_POPULATION_FOR_RATE,
  empiricalBayesSmooth,
  isInScope,
  ols,
  partialCorrelation,
  pearson,
  poissonRateInterval,
  quantileBreaks,
  quintileAnalysis,
  standardize,
  type CrimeCategory,
  type ExposureMeasure,
  type InstitutionScope,
  type Nta2020Code,
} from '@nyc-atlas/shared';
import { GeographyService, type NtaRecord } from '../geography/geography.service.js';
import { CacheService } from '../cache/cache.service.js';
import {
  CACHE_FILES,
  type DemographicsCache,
  type IncidentCache,
  type InstitutionCache,
  type QualityReport,
} from '../ingest/ingest.types.js';
import type { NtaDemographics } from '../census/census.service.js';
import type { UnifiedInstitution } from '../institutions/institutions.service.js';

export interface MetricsQuery {
  category: CrimeCategory;
  exposure: ExposureMeasure;
  scope: InstitutionScope;
  from: string;
  to: string;
  boroughCodes?: number[];
}

export interface NeighborhoodRow {
  nta2020: Nta2020Code;
  name: string;
  boroughName: string;
  boroughCode: number;
  landAreaSqKm: number;
  centroid: [number, number];
  population: number | null;
  rawCount: number;
  ratePer100k: number | null;
  smoothedRatePer100k: number | null;
  confidenceInterval: [number, number] | null;
  institutionCount: number;
  institutionsPerSqKm: number;
  institutionsPer10k: number | null;
  exposureValue: number | null;
  /** Observed minus model-predicted rate. Null without demographics. */
  residual: number | null;
  medianHouseholdIncome: number | null;
  povertyRate: number | null;
  isEnforcementDriven: boolean;
  excluded: { kind: string; explanation: string } | null;
}

/**
 * Which denominator the outcome is expressed against.
 *
 * Per-resident rates need ACS population. Without a Census key the analysis
 * still runs on area density, which is a real measure and keeps every view
 * usable — it is simply not the same quantity, so it is labelled everywhere
 * rather than silently substituted.
 */
export type OutcomeMode = 'RATE_PER_100K' | 'COUNT_PER_SQKM';

export interface MetricsResult {
  outcomeMode: OutcomeMode;
  rows: NeighborhoodRow[];
  scaleBreaks: number[];
  residualExtent: [number, number] | null;
  caveats: string[];
  demographicsAvailable: boolean;
  period: { from: string; to: string };
}

export interface CorrelationSummary {
  raw: number;
  adjusted: number | null;
  confounders: string[];
  n: number;
  modelRSquared: number | null;
  interpretation: string;
}

const CONFOUNDER_LABELS = [
  'median household income',
  'poverty rate',
  'population density',
  'share aged 15-24',
  'owner-occupancy rate',
];

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);

  private incidents: IncidentCache | null = null;
  private institutions: UnifiedInstitution[] = [];
  private demographics: DemographicsCache | null = null;
  private quality: QualityReport | null = null;

  constructor(
    private readonly geography: GeographyService,
    private readonly cache: CacheService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.incidents = await this.cache.read<IncidentCache>(CACHE_FILES.incidents);
    const inst = await this.cache.read<InstitutionCache>(CACHE_FILES.institutions);
    this.institutions = inst?.institutions ?? [];
    this.demographics = await this.cache.read<DemographicsCache>(CACHE_FILES.demographics);
    this.quality = await this.cache.read<QualityReport>(CACHE_FILES.quality);

    if (this.incidents === null) {
      this.logger.warn('No ingest cache found — run `npm run ingest`. Metrics will be empty.');
    } else {
      this.logger.log(
        `Metrics ready: ${Object.keys(this.incidents.aggregate).length} NTAs with incidents, ` +
          `${this.institutions.length} institutions, ` +
          `demographics ${this.demographics?.available === true ? 'available' : 'unavailable'}`,
      );
    }
  }

  get hasData(): boolean {
    return this.incidents !== null;
  }

  get demographicsAvailable(): boolean {
    return this.demographics?.available === true;
  }

  get qualityReport(): QualityReport | null {
    return this.quality;
  }

  get period(): { from: string; to: string } {
    return {
      from: this.incidents?.earliestMonth ?? '',
      to: this.incidents?.latestMonth ?? '',
    };
  }

  getInstitutions(scope: InstitutionScope): UnifiedInstitution[] {
    return this.institutions.filter((i) => isInScope(i.scope, scope));
  }

  /**
   * The core join: crime counts, institution exposure and demographics per NTA,
   * with smoothing, intervals, and confounder-adjusted residuals.
   */
  compute(query: MetricsQuery): MetricsResult {
    const caveats: string[] = [];
    const records = this.geography
      .getResidentialRecords()
      .filter((r) =>
        query.boroughCodes === undefined || query.boroughCodes.length === 0
          ? true
          : query.boroughCodes.includes(r.boroughCode),
      );

    const demographics = this.demographics?.byNta ?? {};
    const demographicsAvailable = this.demographicsAvailable;

    if (!demographicsAvailable) {
      caveats.push(
        'No Census data: rates per resident cannot be computed, so counts are shown raw. ' +
          'Set CENSUS_API_KEY and re-run ingest to enable rates and confounder adjustment.',
      );
    }

    const meta = CRIME_CATEGORY_META[query.category];
    if (meta.isEnforcementDriven) {
      caveats.push(
        `"${meta.label}" is enforcement-driven: counts reflect where police are deployed ` +
          `at least as much as where the behaviour occurs. Treat differences between ` +
          `neighborhoods as a measure of policing, not of underlying crime.`,
      );
    }
    if (query.category !== 'SHOOTING') {
      caveats.push(
        'Complaint data measures reported crime. Reporting is lower where trust in police ' +
          'is lower, which is often the same neighborhoods with least cultural investment — ' +
          'this biases the association toward zero. Shootings are the more robust outcome.',
      );
    }

    // --- institution exposure per NTA -------------------------------------
    const inScope = this.getInstitutions(query.scope);
    const instByNta = new Map<string, number>();
    for (const i of inScope) {
      if (i.nta2020 === null) continue;
      instByNta.set(i.nta2020, (instByNta.get(i.nta2020) ?? 0) + 1);
    }

    // --- counts in the requested window -----------------------------------
    const counts = new Map<string, number>();
    for (const r of records) {
      counts.set(r.nta2020, this.countInWindow(r.nta2020, query));
    }

    // --- rates and smoothing, per borough ---------------------------------
    const smoothedByNta = new Map<string, { smoothed: number; raw: number }>();
    if (demographicsAvailable) {
      // Shrink toward the borough mean rather than the city mean: boroughs
      // differ enough that a citywide prior would distort every estimate.
      const byBorough = new Map<number, NtaRecord[]>();
      for (const r of records) {
        const list = byBorough.get(r.boroughCode) ?? [];
        list.push(r);
        byBorough.set(r.boroughCode, list);
      }
      for (const [, group] of byBorough) {
        const observations = group.map((r) => ({
          key: r.nta2020,
          count: counts.get(r.nta2020) ?? 0,
          population: demographics[r.nta2020]?.population ?? 0,
        }));
        for (const s of empiricalBayesSmooth(observations)) {
          smoothedByNta.set(s.key, { smoothed: s.smoothedRatePer100k, raw: s.rawRatePer100k });
        }
      }
    }

    // --- assemble rows -----------------------------------------------------
    const rows: NeighborhoodRow[] = records.map((r) => {
      const demo: NtaDemographics | undefined = demographics[r.nta2020];
      const population = demo?.population ?? null;
      const count = counts.get(r.nta2020) ?? 0;
      const institutionCount = instByNta.get(r.nta2020) ?? 0;

      const excluded =
        population === null
          ? demographicsAvailable
            // Demographics exist but this neighborhood is missing from them.
            ? { kind: 'NO_DEMOGRAPHICS', explanation: 'No ACS data for this neighborhood.' }
            // Demographics are globally unavailable: that is a mode, not a
            // per-neighborhood exclusion, and is reported in caveats instead.
            : null
          : population < MIN_POPULATION_FOR_RATE
            ? {
                kind: 'LOW_POPULATION',
                explanation:
                  `Population ${population.toLocaleString()} is below ${MIN_POPULATION_FOR_RATE}; ` +
                  `a per-capita rate here would be dominated by noise.`,
              }
            : null;

      const usable = population !== null && excluded === null;
      const countPerSqKm = r.landAreaSqKm > 0 ? count / r.landAreaSqKm : 0;
      const smooth = smoothedByNta.get(r.nta2020);

      const institutionsPer10k =
        usable && population > 0 ? (institutionCount / population) * 10_000 : null;
      const institutionsPerSqKm =
        r.landAreaSqKm > 0 ? institutionCount / r.landAreaSqKm : 0;

      // Per-capita exposure needs population; fall back to area density so the
      // exposure axis stays populated in count mode.
      const exposureValue =
        query.exposure === 'DENSITY' || !demographicsAvailable
          ? institutionsPerSqKm
          : institutionsPer10k;

      return {
        nta2020: r.nta2020,
        name: r.name,
        boroughName: r.boroughName,
        boroughCode: r.boroughCode,
        landAreaSqKm: r.landAreaSqKm,
        centroid: r.centroid,
        population,
        rawCount: count,
        ratePer100k: usable ? (smooth?.raw ?? null) : demographicsAvailable ? null : countPerSqKm,
        smoothedRatePer100k: usable
          ? (smooth?.smoothed ?? null)
          : demographicsAvailable
            ? null
            : countPerSqKm,
        confidenceInterval: usable
          ? (poissonRateInterval(count, population) as [number, number] | null)
          : null,
        institutionCount,
        institutionsPerSqKm,
        institutionsPer10k,
        exposureValue,
        residual: null, // filled below
        medianHouseholdIncome: demo?.medianHouseholdIncome ?? null,
        povertyRate: demo?.povertyRate ?? null,
        isEnforcementDriven: meta.isEnforcementDriven,
        excluded,
      };
    });

    // --- confounder-adjusted residuals -------------------------------------
    let residualExtent: [number, number] | null = null;
    if (demographicsAvailable) {
      const fit = this.fitConfounderModel(rows, demographics);
      if (fit !== null) {
        for (const [nta, residual] of fit.residualByNta) {
          const row = rows.find((x) => x.nta2020 === nta);
          if (row) row.residual = residual;
        }
        const values = [...fit.residualByNta.values()];
        const bound = Math.max(...values.map(Math.abs));
        residualExtent = [-bound, bound];
        caveats.push(
          `Residuals adjust for ${CONFOUNDER_LABELS.join(', ')} ` +
            `(model R² = ${fit.rSquared.toFixed(2)}). Residual confounding from redlining and ` +
            `historical disinvestment remains — these are associations, not effects.`,
        );
      }
    }

    const scaleValues = rows
      .map((r) => r.smoothedRatePer100k)
      .filter((v): v is number => v !== null);
    const scaleBreaks = scaleValues.length > 0 ? quantileBreaks(scaleValues, 7) : [];

    return {
      outcomeMode: demographicsAvailable ? 'RATE_PER_100K' : 'COUNT_PER_SQKM',
      rows,
      scaleBreaks,
      residualExtent,
      caveats,
      demographicsAvailable,
      period: { from: query.from, to: query.to },
    };
  }

  /**
   * Regresses the outcome rate on the socioeconomic confounders and returns
   * per-NTA residuals.
   *
   * This is what separates a finding from an artifact: cultural institutions
   * cluster in wealthy neighborhoods, so a raw gradient mostly measures income.
   * The residual is the part income, poverty, density, age structure and tenure
   * do NOT explain.
   */
  private fitConfounderModel(
    rows: readonly NeighborhoodRow[],
    demographics: Record<string, NtaDemographics>,
  ): { residualByNta: Map<string, number>; rSquared: number } | null {
    const usable = rows.filter(
      (r) =>
        r.excluded === null &&
        r.smoothedRatePer100k !== null &&
        r.population !== null &&
        r.population > 0,
    );
    if (usable.length < 20) return null;

    const predictors: number[][] = [];
    const outcome: number[] = [];
    const keys: string[] = [];

    for (const r of usable) {
      const d = demographics[r.nta2020];
      const income = d?.medianHouseholdIncome;
      const poverty = d?.povertyRate;
      const young = d?.shareAged15to24;
      const owner = d?.ownerOccupancyRate;
      const density = r.population !== null && r.landAreaSqKm > 0 ? r.population / r.landAreaSqKm : null;

      // Listwise deletion: a partially observed row would otherwise silently
      // contribute zeros to the design matrix.
      if (
        income == null || poverty == null || young == null ||
        owner == null || density == null
      ) {
        continue;
      }

      predictors.push([income, poverty, density, young, owner]);
      outcome.push(r.smoothedRatePer100k as number);
      keys.push(r.nta2020);
    }

    if (predictors.length < 20) return null;

    // Standardize columns so the normal equations stay well conditioned —
    // income is ~1e5 while rates are ~1e-1.
    const columns = predictors[0] as number[];
    const standardizedColumns = columns.map((_, j) =>
      standardize(predictors.map((row) => row[j] as number)),
    );
    const X = predictors.map((_, i) => standardizedColumns.map((col) => col[i] as number));

    const fit = ols(X, outcome);
    const residualByNta = new Map<string, number>();
    keys.forEach((k, i) => residualByNta.set(k, fit.residuals[i] as number));
    return { residualByNta, rSquared: fit.rSquared };
  }

  /** Quintile comparison across exposure, the headline view. */
  quintiles(query: MetricsQuery): ReturnType<typeof quintileAnalysis> {
    const result = this.compute(query);
    const rateMode = result.outcomeMode === 'RATE_PER_100K';

    return quintileAnalysis(
      result.rows
        .filter(
          (r) =>
            r.excluded === null &&
            r.exposureValue !== null &&
            (rateMode ? r.population !== null : r.landAreaSqKm > 0),
        )
        .map((r) => ({
          key: r.nta2020,
          exposure: r.exposureValue as number,
          count: r.rawCount,
          // In count mode the "population" slot carries land area scaled to
          // 100k units, so the pooled-rate maths and Poisson intervals apply
          // unchanged and the result reads as incidents per 100 km².
          population: rateMode ? (r.population as number) : r.landAreaSqKm * 1000,
        })),
    );
  }

  /** Raw vs confounder-adjusted association between exposure and outcome. */
  correlation(query: MetricsQuery): CorrelationSummary {
    const result = this.compute(query);
    const demographics = this.demographics?.byNta ?? {};

    const usable = result.rows.filter(
      (r) =>
        r.excluded === null &&
        r.smoothedRatePer100k !== null &&
        r.exposureValue !== null &&
        (this.demographicsAvailable ? r.population !== null : true),
    );

    const x = usable.map((r) => r.exposureValue as number);
    const y = usable.map((r) => r.smoothedRatePer100k as number);
    const raw = pearson(x, y);

    if (!this.demographicsAvailable) {
      return {
        raw,
        adjusted: null,
        confounders: [],
        n: usable.length,
        modelRSquared: null,
        interpretation:
          'Unadjusted association only. Without Census data the dominant confounder — ' +
          'income — cannot be accounted for, and institutions are known to locate in ' +
          'wealthier areas. This number should not be read as an effect.',
      };
    }

    const z: number[][] = [];
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < usable.length; i += 1) {
      const r = usable[i] as NeighborhoodRow;
      const d = demographics[r.nta2020];
      const income = d?.medianHouseholdIncome;
      const poverty = d?.povertyRate;
      const young = d?.shareAged15to24;
      const owner = d?.ownerOccupancyRate;
      const density = r.population !== null && r.landAreaSqKm > 0 ? r.population / r.landAreaSqKm : null;
      if (income == null || poverty == null || young == null || owner == null || density == null) continue;
      z.push([income, poverty, density, young, owner]);
      xs.push(x[i] as number);
      ys.push(y[i] as number);
    }

    if (z.length < 20) {
      return {
        raw, adjusted: null, confounders: [], n: usable.length, modelRSquared: null,
        interpretation: 'Too few neighborhoods with complete demographics to adjust.',
      };
    }

    const cols = (z[0] as number[]).map((_, j) => standardize(z.map((row) => row[j] as number)));
    const Z = z.map((_, i) => cols.map((c) => c[i] as number));
    const adjusted = partialCorrelation(xs, ys, Z);

    return {
      raw,
      adjusted,
      confounders: CONFOUNDER_LABELS,
      n: xs.length,
      modelRSquared: ols(Z, ys).rSquared,
      interpretation: buildInterpretation(raw, adjusted),
    };
  }

  private countInWindow(nta: Nta2020Code, query: MetricsQuery): number {
    const byCategory = this.incidents?.aggregate[nta];
    if (byCategory === undefined) return 0;
    const months = byCategory[query.category];
    if (months === undefined) return 0;

    let total = 0;
    for (const [month, n] of Object.entries(months)) {
      if (month >= query.from.slice(0, 7) && month <= query.to.slice(0, 7)) total += n;
    }
    return total;
  }
}

function buildInterpretation(raw: number, adjusted: number): string {
  const dir = raw < 0 ? 'fewer' : 'more';
  const shrank = Math.abs(adjusted) < Math.abs(raw) * 0.5;
  const flipped = Math.sign(adjusted) !== Math.sign(raw) && Math.abs(adjusted) > 0.05;

  const head =
    `Unadjusted, neighborhoods with more cultural institutions show ${dir} incidents ` +
    `(r = ${raw.toFixed(2)}). After adjusting for income, poverty, density, age structure ` +
    `and tenure, the partial correlation is ${adjusted.toFixed(2)}.`;

  const tail = flipped
    ? ' The association reverses once socioeconomics are accounted for, which strongly ' +
      'suggests the raw pattern was driven by where institutions are sited rather than by ' +
      'any effect of them.'
    : shrank
      ? ' Most of the raw association is explained by socioeconomic differences between ' +
        'neighborhoods rather than by cultural infrastructure itself.'
      : ' A substantial part of the association persists after adjustment, though residual ' +
        'confounding from redlining and historical disinvestment is certain and unmeasured.';

  return `${head}${tail} This is an association, not a causal effect; institutions are sited ` +
    `in already-safer areas, so causality plausibly runs in both directions.`;
}
