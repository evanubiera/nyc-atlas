import { pearson } from '@nyc-atlas/shared';

/**
 * The modifiable areal unit problem, measured rather than disclaimed
 * (specs/007, 008 §2.10).
 *
 * Every figure in this atlas depends on a boundary somebody else drew. The
 * same points aggregated to coarser units can produce a different, sometimes
 * reversed, correlation — so re-running the association over CDTAs says
 * whether the NTA result is a finding or an artifact of the grid.
 *
 * This is a sensitivity check, not a second answer: a result that survives
 * both geographies is better supported, and one that does not should not be
 * reported as if the boundary were incidental.
 */

export interface AreaUnitInput {
  /** The coarser unit this row rolls up into. */
  unitKey: string;
  population: number | null;
  rawCount: number;
  institutionCount: number;
}

export interface AreaUnit {
  unitKey: string;
  population: number;
  rawCount: number;
  institutionCount: number;
}

export interface MaupCheck {
  fineCorrelation: number | null;
  coarseCorrelation: number | null;
  fineCount: number;
  coarseCount: number;
  /** Absolute change in r between the two geographies. */
  shift: number | null;
  agrees: boolean;
}

/** Counts and population sum across units; rows with no population cannot contribute a rate. */
export function aggregateToUnits(rows: readonly AreaUnitInput[]): AreaUnit[] {
  const units = new Map<string, AreaUnit>();

  for (const row of rows) {
    if (row.population === null || row.population <= 0) continue;

    let unit = units.get(row.unitKey);
    if (!unit) {
      unit = { unitKey: row.unitKey, population: 0, rawCount: 0, institutionCount: 0 };
      units.set(row.unitKey, unit);
    }
    unit.population += row.population;
    unit.rawCount += row.rawCount;
    unit.institutionCount += row.institutionCount;
  }

  return [...units.values()].sort((a, b) => (a.unitKey < b.unitKey ? -1 : 1));
}

/** Exposure against outcome, both per-resident, for one set of areal units. */
export function correlationOf(units: readonly AreaUnit[]): number | null {
  if (units.length < 3) return null;

  const exposure = units.map((u) => (u.institutionCount / u.population) * 10_000);
  const outcome = units.map((u) => (u.rawCount / u.population) * 100_000);
  const r = pearson(exposure, outcome);

  return Number.isFinite(r) ? r : null;
}

/**
 * Agreement means the same sign and a shift small enough not to change the
 * reading. 0.15 is a judgement, stated here rather than buried: beyond it the
 * two geographies are telling materially different stories.
 */
export const MAUP_AGREEMENT_THRESHOLD = 0.15;

export function compareGeographies(
  fine: readonly AreaUnit[],
  coarse: readonly AreaUnit[],
): MaupCheck {
  const fineCorrelation = correlationOf(fine);
  const coarseCorrelation = correlationOf(coarse);

  const shift =
    fineCorrelation === null || coarseCorrelation === null
      ? null
      : Math.abs(fineCorrelation - coarseCorrelation);

  const sameSign =
    fineCorrelation !== null &&
    coarseCorrelation !== null &&
    Math.sign(fineCorrelation) === Math.sign(coarseCorrelation);

  return {
    fineCorrelation,
    coarseCorrelation,
    fineCount: fine.length,
    coarseCount: coarse.length,
    shift,
    agrees: sameSign && shift !== null && shift <= MAUP_AGREEMENT_THRESHOLD,
  };
}

export function describeMaup(check: MaupCheck): string {
  if (check.fineCorrelation === null || check.coarseCorrelation === null) {
    return (
      'Not enough neighborhoods with a population denominator to re-run the ' +
      'association over community districts, so the boundary sensitivity is unknown.'
    );
  }

  const head =
    `Re-aggregated from ${check.fineCount} neighborhoods to ${check.coarseCount} ` +
    `community districts, the correlation moves from ${check.fineCorrelation.toFixed(2)} ` +
    `to ${check.coarseCorrelation.toFixed(2)}.`;

  return check.agrees
    ? `${head} The association survives the change of boundary, so it is not an artifact ` +
        'of how the neighborhoods were drawn.'
    : `${head} The association changes materially with the boundary, which means the ` +
        'neighborhood result reflects the grid as much as the city. Treat it with caution.';
}
