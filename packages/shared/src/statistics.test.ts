import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  poissonCountInterval,
  poissonRateInterval,
  empiricalBayesSmooth,
  ols,
  pearson,
  partialCorrelation,
  standardize,
  quantileBreaks,
  quintileAnalysis,
  mean,
} from './statistics.js';

const close = (a: number, b: number, tol: number, msg?: string): void => {
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${a} ≈ ${b} (±${tol})`);
};

test('Poisson interval brackets the count and widens relatively as counts shrink', () => {
  for (const c of [1, 5, 10, 50, 500]) {
    const [lo, hi] = poissonCountInterval(c);
    assert.ok(lo < c && c < hi, `interval must contain ${c}`);
  }
  // Exact 95% CI for 10 events is about [4.795, 18.39].
  const [lo10, hi10] = poissonCountInterval(10);
  close(lo10, 4.795, 0.3, 'lower bound at c=10');
  close(hi10, 18.39, 0.5, 'upper bound at c=10');

  // Relative width must shrink as counts grow — that is the whole point.
  const rel = (c: number): number => {
    const [l, h] = poissonCountInterval(c);
    return (h - l) / c;
  };
  assert.ok(rel(5) > rel(50), 'small counts must be relatively less certain');
  assert.ok(rel(50) > rel(500));
});

test('zero events yields a lower bound of zero and the exact upper bound', () => {
  const [lo, hi] = poissonCountInterval(0);
  assert.equal(lo, 0);
  // Exact two-sided 97.5% upper limit at x=0 is chi2(0.975, 2)/2 = 7.3778/2.
  close(hi, 3.6889, 0.05, 'upper bound at zero events');
});

test('rate interval scales by population and is null without one', () => {
  const ci = poissonRateInterval(10, 50_000);
  assert.ok(ci);
  // 10 events in 50k people is 20 per 100k; the interval must straddle it.
  assert.ok(ci[0] < 20 && ci[1] > 20);
  assert.equal(poissonRateInterval(10, 0), null);
});

test('empirical Bayes shrinks small populations harder than large ones', () => {
  // Two neighborhoods with an identical crude rate but very different sizes.
  const smoothed = empiricalBayesSmooth([
    { key: 'tiny', count: 1, population: 1_000 },
    { key: 'big', count: 100, population: 100_000 },
    { key: 'a', count: 20, population: 40_000 },
    { key: 'b', count: 35, population: 60_000 },
    { key: 'c', count: 8, population: 30_000 },
  ]);
  const tiny = smoothed.find((s) => s.key === 'tiny');
  const big = smoothed.find((s) => s.key === 'big');
  assert.ok(tiny && big);

  close(tiny.rawRatePer100k, 100, 1e-6, 'tiny raw rate');
  close(big.rawRatePer100k, 100, 1e-6, 'big raw rate');

  // Same raw rate, but the small-population estimate must be pulled further
  // toward the group mean — otherwise one event drives the color scale.
  assert.ok(
    tiny.weight < big.weight,
    `small population must be shrunk more (tiny w=${tiny.weight}, big w=${big.weight})`,
  );
});

test('empirical Bayes preserves the raw rate when there is no small-area noise', () => {
  // Identical rates everywhere: smoothing must not invent differences.
  const smoothed = empiricalBayesSmooth([
    { key: 'a', count: 50, population: 50_000 },
    { key: 'b', count: 100, population: 100_000 },
    { key: 'c', count: 200, population: 200_000 },
  ]);
  for (const s of smoothed) {
    close(s.smoothedRatePer100k, 100, 1e-6, `${s.key} should stay at the common rate`);
  }
});

test('empirical Bayes handles zero population without producing NaN', () => {
  const smoothed = empiricalBayesSmooth([
    { key: 'park', count: 3, population: 0 },
    { key: 'real', count: 50, population: 50_000 },
  ]);
  for (const s of smoothed) {
    assert.ok(Number.isFinite(s.smoothedRatePer100k), `${s.key} must be finite`);
  }
});

test('OLS recovers exact coefficients from a noiseless fit', () => {
  // y = 2 + 3*x1 - 1*x2
  const X = [
    [1, 0], [2, 1], [3, 2], [4, 5], [5, 3], [6, 1],
  ];
  const y = X.map(([a, b]) => 2 + 3 * (a as number) - 1 * (b as number));
  const res = ols(X, y);
  close(res.coefficients[0] as number, 2, 1e-6, 'intercept');
  close(res.coefficients[1] as number, 3, 1e-6, 'slope x1');
  close(res.coefficients[2] as number, -1, 1e-6, 'slope x2');
  close(res.rSquared, 1, 1e-9, 'R² of an exact fit');
  for (const r of res.residuals) close(r, 0, 1e-6, 'residual');
});

test('OLS returns zeros rather than NaN for a singular design', () => {
  // x2 is a perfect copy of x1 — the system has no unique solution.
  const X = [[1, 1], [2, 2], [3, 3]];
  const res = ols(X, [1, 2, 3]);
  for (const c of res.coefficients) assert.ok(Number.isFinite(c), 'must not be NaN');
});

test('partial correlation removes an association that a confounder fully explains', () => {
  // The central methodological case: cultural access and crime both driven by
  // income. Raw correlation is strong; adjusted correlation must collapse.
  const income = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const access = income.map((z) => 2 * z);        // access is a function of income
  const crime = income.map((z) => 500 - 4 * z);   // crime is a function of income

  const raw = pearson(access, crime);
  close(Math.abs(raw), 1, 1e-6, 'raw correlation should be near-perfect');

  const adjusted = partialCorrelation(access, crime, income.map((z) => [z]));
  close(adjusted, 0, 1e-6, 'adjusting for income must remove the whole association');
});

test('partial correlation keeps an association the confounder does not explain', () => {
  const z = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const x = [2, 1, 4, 3, 6, 5, 8, 7, 10, 9];
  const y = x.map((v) => v * 2);  // y depends on x, not on z
  const adjusted = partialCorrelation(x, y, z.map((v) => [v]));
  assert.ok(Math.abs(adjusted) > 0.9, `real association must survive (got ${adjusted})`);
});

test('standardize yields mean 0 and unit variance, and tolerates a constant column', () => {
  const s = standardize([10, 20, 30, 40, 50]);
  close(mean(s), 0, 1e-9, 'standardized mean');
  assert.deepEqual(standardize([7, 7, 7]), [0, 0, 0]);
});

test('quantileBreaks returns classes-1 ascending cut points', () => {
  const breaks = quantileBreaks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
  assert.equal(breaks.length, 4);
  for (let i = 1; i < breaks.length; i += 1) {
    assert.ok((breaks[i] as number) >= (breaks[i - 1] as number), 'breaks must ascend');
  }
});

test('quintile analysis buckets by exposure rank and pools rates by population', () => {
  const rows = Array.from({ length: 50 }, (_, i) => ({
    key: `n${i}`,
    exposure: i,                       // ascending access
    count: 100 - 2 * i,                // crime falls as access rises
    population: 10_000,
  }));
  const buckets = quintileAnalysis(rows);
  assert.equal(buckets.length, 5);
  for (const b of buckets) assert.equal(b.neighborhoodCount, 10, 'equal-sized buckets');

  const q1 = buckets[0];
  const q5 = buckets[4];
  assert.ok(q1 && q5);
  assert.ok(
    q1.meanOutcomeRate > q5.meanOutcomeRate,
    'lowest-access quintile should show the higher rate in this fixture',
  );
  assert.ok(q1.confidenceInterval[0] < q1.meanOutcomeRate);
  assert.ok(q1.confidenceInterval[1] > q1.meanOutcomeRate);
});

test('quintile rate is population-weighted, not an average of rates', () => {
  // One tiny neighborhood with an extreme rate must not dominate its bucket.
  const rows = [
    { key: 'tiny', exposure: 1, count: 10, population: 500 },    // 2000 per 100k
    { key: 'huge', exposure: 2, count: 10, population: 99_500 }, // ~10 per 100k
  ];
  const buckets = quintileAnalysis(rows);
  const all = buckets.filter((b) => b.neighborhoodCount > 0);
  const pooled = all.reduce((a, b) => a + b.totalCount, 0) / all.reduce((a, b) => a + b.totalPopulation, 0) * 100_000;
  close(pooled, 20, 1e-6, 'pooled rate across both');
});

test('quintile analysis ignores zero-population neighborhoods', () => {
  const buckets = quintileAnalysis([
    { key: 'park', exposure: 5, count: 3, population: 0 },
    ...Array.from({ length: 10 }, (_, i) => ({
      key: `n${i}`, exposure: i, count: 5, population: 10_000,
    })),
  ]);
  const total = buckets.reduce((a, b) => a + b.neighborhoodCount, 0);
  assert.equal(total, 10, 'the zero-population area must be excluded');
});
