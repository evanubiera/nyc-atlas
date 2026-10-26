/**
 * Statistical primitives for neighborhood rate analysis.
 *
 * Pure functions, no I/O, so they can be tested directly. The methodology they
 * implement is specified in specs/007-methodology.md.
 */

/**
 * 95% confidence interval for a Poisson count, via Byar's approximation.
 *
 * Counts are small in many NTAs — a neighborhood with 3 shootings needs an
 * interval, not a point estimate. Byar's is accurate to within ~1% for counts
 * above about 5 and degrades gracefully below that; the exact chi-square method
 * would need a gamma quantile implementation for negligible gain here.
 */
export function poissonCountInterval(count: number): readonly [number, number] {
  if (count < 0 || !Number.isFinite(count)) return [0, 0];
  const z = 1.959964; // 97.5th percentile of the standard normal

  const lower =
    count === 0
      ? 0
      : count * (1 - 1 / (9 * count) - z / (3 * Math.sqrt(count))) ** 3;

  const c1 = count + 1;
  const upper = c1 * (1 - 1 / (9 * c1) + z / (3 * Math.sqrt(c1))) ** 3;

  return [Math.max(0, lower), upper];
}

/** Converts a count interval to a rate-per-100k interval. */
export function poissonRateInterval(
  count: number,
  population: number,
): readonly [number, number] | null {
  if (population <= 0) return null;
  const [lo, hi] = poissonCountInterval(count);
  return [(lo / population) * 100_000, (hi / population) * 100_000];
}

export interface RateObservation {
  key: string;
  count: number;
  population: number;
}

export interface SmoothedRate {
  key: string;
  rawRatePer100k: number;
  smoothedRatePer100k: number;
  /** 0 = fully shrunk to the group mean, 1 = the raw rate is kept as-is. */
  weight: number;
}

/**
 * Marshall's method-of-moments empirical Bayes smoother (gamma-Poisson).
 *
 * Raw rates in small-population neighborhoods are wildly unstable: one shooting
 * in a 4,000-person NTA is 25 per 100,000, which is an artifact of the
 * denominator rather than a finding. Shrinking toward the group mean in
 * proportion to each neighborhood's own uncertainty keeps the color scale
 * honest. Raw rates are still reported alongside — see specs/007 §7.
 */
export function empiricalBayesSmooth(observations: readonly RateObservation[]): SmoothedRate[] {
  const usable = observations.filter((o) => o.population > 0);
  if (usable.length === 0) return [];

  const totalCount = usable.reduce((a, o) => a + o.count, 0);
  const totalPop = usable.reduce((a, o) => a + o.population, 0);

  const m = totalCount / totalPop;
  const meanPop = totalPop / usable.length;

  let weightedSquares = 0;
  for (const o of usable) {
    const r = o.count / o.population;
    weightedSquares += o.population * (r - m) ** 2;
  }
  let s2 = weightedSquares / totalPop - m / meanPop;
  if (!Number.isFinite(s2) || s2 <= 0) s2 = 0; // no real between-area variation

  return observations.map((o) => {
    const raw = o.population > 0 ? (o.count / o.population) * 100_000 : 0;
    if (o.population <= 0) {
      return { key: o.key, rawRatePer100k: raw, smoothedRatePer100k: raw, weight: 0 };
    }
      const w = s2 === 0 ? 0 : s2 / (s2 + m / o.population);
    const smoothed = (w * (o.count / o.population) + (1 - w) * m) * 100_000;
    return { key: o.key, rawRatePer100k: raw, smoothedRatePer100k: smoothed, weight: w };
  });
}

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function standardDeviation(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

export function pearson(xs: readonly number[], ys: readonly number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const a = (xs[i] as number) - mx;
    const b = (ys[i] as number) - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

/** Quantile of a sorted-or-unsorted sample, linear interpolation. */
export function quantile(xs: readonly number[], q: number): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * Math.min(Math.max(q, 0), 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * (pos - lo);
}

/** Evenly spaced quantile breaks, excluding the 0th and 100th. */
export function quantileBreaks(xs: readonly number[], classes: number): number[] {
  const breaks: number[] = [];
  for (let i = 1; i < classes; i += 1) {
    breaks.push(quantile(xs, i / classes));
  }
  return breaks;
}

export interface OlsResult {
  /** coefficients[0] is the intercept. */
  coefficients: number[];
  residuals: number[];
  fitted: number[];
  rSquared: number;
  n: number;
}

/**
 * Multiple linear regression by normal equations, (X'X)b = X'y, solved with
 * Gaussian elimination. An intercept column is prepended to the design matrix.
 *
 * Design sizes here are tiny (197 rows, a handful of predictors), so the
 * numerical shortcomings of normal equations versus QR do not bite. Columns are
 * standardized by the caller, which keeps the system well conditioned.
 */
export function ols(X: readonly (readonly number[])[], y: readonly number[]): OlsResult {
  const n = X.length;
  if (n === 0) return { coefficients: [], residuals: [], fitted: [], rSquared: 0, n: 0 };
  const k = (X[0] as readonly number[]).length;

  const design: number[][] = X.map((row) => [1, ...row]);
  const p = k + 1;

  const xtx: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const xty: number[] = new Array<number>(p).fill(0);

  for (let i = 0; i < n; i += 1) {
    const row = design[i] as number[];
    const yi = y[i] as number;
    for (let a = 0; a < p; a += 1) {
      xty[a] = (xty[a] as number) + (row[a] as number) * yi;
      for (let b = 0; b < p; b += 1) {
        (xtx[a] as number[])[b] = ((xtx[a] as number[])[b] as number) + (row[a] as number) * (row[b] as number);
      }
    }
  }

  const coefficients = solveLinearSystem(xtx, xty);

  const fitted = design.map((row) => row.reduce((acc, v, j) => acc + v * (coefficients[j] ?? 0), 0));
  const residuals = y.map((yi, i) => yi - (fitted[i] as number));

  const my = mean(y);
  const ssTot = y.reduce((a, yi) => a + (yi - my) ** 2, 0);
  const ssRes = residuals.reduce((a, r) => a + r * r, 0);
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { coefficients, residuals, fitted, rSquared, n };
}

/** Gauss-Jordan with partial pivoting. Returns zeros if the system is singular. */
function solveLinearSystem(a: readonly (readonly number[])[], b: readonly number[]): number[] {
  const n = b.length;
  const m: number[][] = a.map((row, i) => [...row, b[i] as number]);

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs((m[r] as number[])[col] as number) > Math.abs((m[pivot] as number[])[col] as number)) {
        pivot = r;
      }
    }
    const pivotRow = m[pivot] as number[];
    const pivotVal = pivotRow[col] as number;
    if (Math.abs(pivotVal) < 1e-12) return new Array<number>(n).fill(0);

    m[pivot] = m[col] as number[];
    m[col] = pivotRow;

    for (let j = col; j <= n; j += 1) {
      pivotRow[j] = (pivotRow[j] as number) / pivotVal;
    }
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const factor = (m[r] as number[])[col] as number;
      if (factor === 0) continue;
      for (let j = col; j <= n; j += 1) {
        (m[r] as number[])[j] = ((m[r] as number[])[j] as number) - factor * (pivotRow[j] as number);
      }
    }
  }

  return m.map((row) => row[n] as number);
}

export function standardize(xs: readonly number[]): number[] {
  const m = mean(xs);
  const sd = standardDeviation(xs);
  if (sd === 0) return xs.map(() => 0);
  return xs.map((x) => (x - m) / sd);
}

/**
 * This is the number that matters for the research question: the raw
 * correlation between cultural access and crime is dominated by income, and the
 * partial correlation is what survives adjustment. It remains an associational
 * quantity — residual confounding from redlining and disinvestment is certain,
 * not merely possible (specs/007 §5).
 */
export function partialCorrelation(
  x: readonly number[],
  y: readonly number[],
  z: readonly (readonly number[])[],
): number {
  if (z.length === 0 || (z[0] as readonly number[]).length === 0) return pearson(x, y);
  const rx = ols(z, x).residuals;
  const ry = ols(z, y).residuals;
  return pearson(rx, ry);
}

export interface QuintileInput {
  key: string;
  exposure: number;
  count: number;
  population: number;
}

export interface QuintileBucketResult {
  quintile: 1 | 2 | 3 | 4 | 5;
  exposureRange: readonly [number, number];
  meanOutcomeRate: number;
  confidenceInterval: readonly [number, number];
  neighborhoodCount: number;
  totalPopulation: number;
  totalCount: number;
}

/**
 * Groups neighborhoods into exposure quintiles and computes a
 * population-weighted outcome rate per bucket with a Poisson interval.
 *
 * Buckets are formed by rank rather than by value, which keeps the five groups
 * equal in size even though the exposure distribution is heavily skewed — many
 * neighborhoods have no institutions at all.
 *
 * The rate is pooled (total events / total population), not an average of
 * per-neighborhood rates: averaging rates would weight a 2,000-person NTA the
 * same as a 90,000-person one and let small-area noise drive the result.
 */
export function quintileAnalysis(rows: readonly QuintileInput[]): QuintileBucketResult[] {
  const usable = rows.filter((r) => r.population > 0 && Number.isFinite(r.exposure));
  if (usable.length === 0) return [];

  const sorted = [...usable].sort((a, b) => a.exposure - b.exposure);
  const buckets: QuintileInput[][] = [[], [], [], [], []];

  sorted.forEach((row, i) => {
    const idx = Math.min(4, Math.floor((i * 5) / sorted.length));
    (buckets[idx] as QuintileInput[]).push(row);
  });

  return buckets.map((bucket, i) => {
    const totalCount = bucket.reduce((a, r) => a + r.count, 0);
    const totalPopulation = bucket.reduce((a, r) => a + r.population, 0);
    const rate = totalPopulation > 0 ? (totalCount / totalPopulation) * 100_000 : 0;
    const ci = poissonRateInterval(totalCount, totalPopulation) ?? ([0, 0] as const);
    const exposures = bucket.map((r) => r.exposure);

    return {
      quintile: (i + 1) as 1 | 2 | 3 | 4 | 5,
      exposureRange: [
        exposures.length > 0 ? Math.min(...exposures) : 0,
        exposures.length > 0 ? Math.max(...exposures) : 0,
      ] as const,
      meanOutcomeRate: rate,
      confidenceInterval: ci,
      neighborhoodCount: bucket.length,
      totalPopulation,
      totalCount,
    };
  });
}

/** One neighborhood's contribution to a pooled group figure. */
export interface WeightedObservation {
  /** The quantity being pooled: a count, or a value to be averaged. */
  readonly value: number | null;
  /** Residents, students, or whatever the measure is "per". */
  readonly weight: number | null;
}

/**
 * Pools a count across a group and expresses it per `per` units of weight.
 *
 * This is deliberately not a mean of per-neighborhood rates. Averaging rates
 * gives a 3,000-person neighborhood with one supermarket the same say as a
 * 90,000-person one with eight, which describes neighborhoods rather than
 * people. Pooling the numerator and denominator gives the rate an actual
 * resident of the group experiences.
 *
 * Observations with no weight contribute nothing — including their counts,
 * which would otherwise inflate the numerator against a denominator that never
 * grew.
 */
export function pooledRate(
  observations: readonly WeightedObservation[],
  per: number,
): number | null {
  let total = 0;
  let weight = 0;
  for (const o of observations) {
    if (o.value === null || o.weight === null || o.weight <= 0) continue;
    total += o.value;
    weight += o.weight;
  }
  if (weight <= 0) return null;
  return (total / weight) * per;
}

/**
 * Weighted mean, skipping observations missing either part.
 *
 * Used where the quantity is already a rate or a median and cannot simply be
 * summed — income and poverty weighted by population, proficiency weighted by
 * students tested.
 */
export function weightedMean(observations: readonly WeightedObservation[]): number | null {
  let weighted = 0;
  let weight = 0;
  for (const o of observations) {
    if (o.value === null || o.weight === null || o.weight <= 0) continue;
    weighted += o.value * o.weight;
    weight += o.weight;
  }
  if (weight <= 0) return null;
  return weighted / weight;
}
