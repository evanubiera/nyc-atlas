import { ols, partialCorrelation, standardize } from '@nyc-atlas/shared';
import type { NtaDemographics } from '../census/census.service.js';
import type { NeighborhoodRow } from './metrics.types.js';

/** Below this, the five-predictor fit is not worth reporting. */
export const MIN_ROWS_FOR_MODEL = 20;

export interface ConfounderMatrix {
  /** The neighborhoods that survived listwise deletion, in input order. */
  rows: NeighborhoodRow[];
  predictors: number[][];
}

export interface ConfounderFit {
  residualByNta: Map<string, number>;
  rSquared: number;
}

function populationDensity(row: NeighborhoodRow): number | null {
  if (row.population === null || row.landAreaSqKm <= 0) return null;
  return row.population / row.landAreaSqKm;
}

export function hasUsableRate(row: NeighborhoodRow): boolean {
  return (
    row.excluded === null &&
    row.smoothedRatePer100k !== null &&
    row.population !== null &&
    row.population > 0
  );
}

/**
 * The five socioeconomic predictors for one neighborhood, or null when any is
 * missing.
 *
 * Returning null rather than substituting zeros is listwise deletion: a
 * partially observed neighborhood would otherwise contribute a row of zeros
 * that the regression reads as real, low values.
 */
function predictorsFor(
  row: NeighborhoodRow,
  demographics: NtaDemographics | undefined,
): number[] | null {
  const income = demographics?.medianHouseholdIncome;
  const poverty = demographics?.povertyRate;
  const young = demographics?.shareAged15to24;
  const owner = demographics?.ownerOccupancyRate;
  const density = populationDensity(row);

  if (income == null || poverty == null || young == null || owner == null || density == null) {
    return null;
  }
  return [income, poverty, density, young, owner];
}

export function buildConfounderMatrix(
  rows: readonly NeighborhoodRow[],
  demographics: Record<string, NtaDemographics>,
): ConfounderMatrix {
  const matrix: ConfounderMatrix = { rows: [], predictors: [] };

  for (const row of rows) {
    const predictors = predictorsFor(row, demographics[row.nta2020]);
    if (predictors === null) continue;
    matrix.rows.push(row);
    matrix.predictors.push(predictors);
  }

  return matrix;
}

export function smoothedRatesOf(rows: readonly NeighborhoodRow[]): number[] {
  return rows.map((row) => row.smoothedRatePer100k as number);
}

/**
 * Standardizes each column so the normal equations stay well conditioned:
 * income is ~1e5 while rates are ~1e-1.
 */
export function standardizeColumns(predictors: readonly number[][]): number[][] {
  const firstRow = predictors[0];
  if (firstRow === undefined) return [];

  const columns = firstRow.map((_, index) =>
    standardize(predictors.map((row) => row[index] as number)),
  );
  return predictors.map((_, rowIndex) => columns.map((column) => column[rowIndex] as number));
}

export function fitConfounderModel(
  rows: readonly NeighborhoodRow[],
  demographics: Record<string, NtaDemographics>,
): ConfounderFit | null {
  const usable = rows.filter(hasUsableRate);
  if (usable.length < MIN_ROWS_FOR_MODEL) return null;

  const matrix = buildConfounderMatrix(usable, demographics);
  if (matrix.predictors.length < MIN_ROWS_FOR_MODEL) return null;

  const fit = ols(standardizeColumns(matrix.predictors), smoothedRatesOf(matrix.rows));
  const residualByNta = new Map<string, number>();
  matrix.rows.forEach((row, index) =>
    residualByNta.set(row.nta2020, fit.residuals[index] as number),
  );

  return { residualByNta, rSquared: fit.rSquared };
}

export interface AdjustedAssociation {
  adjusted: number;
  modelRSquared: number;
  n: number;
}

export function adjustedAssociation(
  rows: readonly NeighborhoodRow[],
  demographics: Record<string, NtaDemographics>,
): AdjustedAssociation | null {
  const matrix = buildConfounderMatrix(rows, demographics);
  if (matrix.predictors.length < MIN_ROWS_FOR_MODEL) return null;

  const exposures = matrix.rows.map((row) => row.exposureValue as number);
  const outcomes = smoothedRatesOf(matrix.rows);
  const standardized = standardizeColumns(matrix.predictors);

  return {
    adjusted: partialCorrelation(exposures, outcomes, standardized),
    modelRSquared: ols(standardized, outcomes).rSquared,
    n: exposures.length,
  };
}
