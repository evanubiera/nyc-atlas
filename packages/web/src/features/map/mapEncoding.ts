import { quantile } from '@nyc-atlas/shared';
import type { MetricsPayload, NeighborhoodMetric } from '../../store/atlasApi.js';
import type { MapMode } from '../filters/filtersSlice.js';
import {
  bivariateColor,
  divergingColor,
  hexToRgba,
  sequentialColor,
  tercile,
  type Rgba,
} from './colorScales.js';

export const MAX_EXTRUSION_METRES = 2600;

export interface NtaProps {
  nta2020: string;
  ntaname: string;
  boroname: string;
  ntatype: string;
}

export interface Terciles {
  outcome: [number, number];
  exposure: [number, number];
}

/** The theme tokens the encoders read. Narrow so they stay testable. */
export interface EncodingTheme {
  gridline: string;
  divergingNeutral: string;
}

export function indexByNta(
  rows: readonly NeighborhoodMetric[],
): Map<string, NeighborhoodMetric> {
  const byNta = new Map<string, NeighborhoodMetric>();
  for (const row of rows) byNta.set(row.nta2020, row);
  return byNta;
}

/** Tercile cuts for the bivariate grid, computed once per dataset. */
export function computeTerciles(rows: readonly NeighborhoodMetric[]): Terciles | null {
  const usable = rows.filter(
    (row) =>
      row.excluded === null && row.smoothedRatePer100k !== null && row.exposureValue !== null,
  );
  if (usable.length === 0) return null;

  const outcomes = usable.map((row) => row.smoothedRatePer100k as number);
  const exposures = usable.map((row) => row.exposureValue as number);

  return {
    outcome: [quantile(outcomes, 1 / 3), quantile(outcomes, 2 / 3)],
    exposure: [quantile(exposures, 1 / 3), quantile(exposures, 2 / 3)],
  };
}

export function maxSmoothedRate(rows: readonly NeighborhoodMetric[]): number {
  const rates = rows
    .map((row) => row.smoothedRatePer100k)
    .filter((rate): rate is number => rate !== null);
  return rates.length > 0 ? Math.max(...rates) : 1;
}

export interface FillContext {
  byNta: ReadonlyMap<string, NeighborhoodMetric>;
  mapMode: MapMode;
  metrics: MetricsPayload | undefined;
  terciles: Terciles | null;
  theme: EncodingTheme;
}

/**
 * Non-residential and excluded areas render recessively rather than
 * disappearing — specs/001 FR-4.4.
 */
export function buildFillAccessor(context: FillContext) {
  const { byNta, mapMode, metrics, terciles, theme } = context;
  const missing = hexToRgba(theme.gridline, 70);

  return (feature: { properties: NtaProps }): Rgba => {
    const row = byNta.get(feature.properties.nta2020);
    if (!row || row.excluded !== null) return hexToRgba(theme.gridline, 90);

    if (mapMode === 'RESIDUAL') {
      if (row.residual === null) return missing;
      return divergingColor(
        row.residual,
        metrics?.residualExtent?.[1] ?? 1,
        theme.divergingNeutral,
      );
    }

    if (mapMode === 'BIVARIATE' && terciles) {
      if (row.smoothedRatePer100k === null || row.exposureValue === null) return missing;
      return bivariateColor(
        tercile(row.exposureValue, terciles.exposure),
        tercile(row.smoothedRatePer100k, terciles.outcome),
      );
    }

    if (row.smoothedRatePer100k === null) return missing;
    return sequentialColor(row.smoothedRatePer100k, metrics?.scaleBreaks ?? []);
  };
}

export interface ElevationContext {
  byNta: ReadonlyMap<string, NeighborhoodMetric>;
  mapMode: MapMode;
  metrics: MetricsPayload | undefined;
  maxRate: number;
  extrude: boolean;
}

/**
 * Height always encodes magnitude, never sign — in residual mode the sign is
 * carried by colour. The smoothed rate drives it, never the raw one: a single
 * event in a small neighborhood would otherwise throw up a spike that is a
 * denominator artifact.
 */
export function buildElevationAccessor(context: ElevationContext) {
  const { byNta, mapMode, metrics, maxRate, extrude } = context;

  return (feature: { properties: NtaProps }): number => {
    if (!extrude) return 0;

    const row = byNta.get(feature.properties.nta2020);
    if (!row) return 0;

    if (mapMode === 'RESIDUAL') {
      const extent = metrics?.residualExtent?.[1] ?? 1;
      return row.residual === null
        ? 0
        : (Math.abs(row.residual) / extent) * MAX_EXTRUSION_METRES;
    }

    return row.smoothedRatePer100k === null
      ? 0
      : (row.smoothedRatePer100k / maxRate) * MAX_EXTRUSION_METRES;
  };
}
