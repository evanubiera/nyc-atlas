import type { NeighborhoodMetric } from '../../store/atlasApi.js';

/**
 * Geometry for the exposure-vs-outcome scatter (specs/006, 008 §6.1).
 *
 * Kept apart from the drawing so the placement can be tested without a DOM,
 * and so the chart and any label it carries are positioned by one calculation
 * rather than two that can disagree.
 */

export interface ScatterPoint {
  nta2020: string;
  name: string;
  /** Cultural-institution exposure. */
  x: number;
  /** Smoothed outcome rate. */
  y: number;
}

export interface Extent {
  min: number;
  max: number;
}

/**
 * Excluded neighborhoods and missing values are dropped rather than plotted at
 * zero: a neighborhood with no rate is not a neighborhood with a rate of none.
 */
export function toScatterPoints(rows: readonly NeighborhoodMetric[]): ScatterPoint[] {
  const points: ScatterPoint[] = [];

  for (const row of rows) {
    if (row.excluded !== null) continue;
    if (row.exposureValue === null || row.smoothedRatePer100k === null) continue;
    points.push({
      nta2020: row.nta2020,
      name: row.name,
      x: row.exposureValue,
      y: row.smoothedRatePer100k,
    });
  }

  return points;
}

/** Padded by 5% so points never sit on the axis line itself. */
export function extentOf(values: readonly number[]): Extent {
  if (values.length === 0) return { min: 0, max: 1 };

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return { min: min === 0 ? 0 : min * 0.9, max: max === 0 ? 1 : max * 1.1 };

  const pad = (max - min) * 0.05;
  return { min: min - pad, max: max + pad };
}

/** Maps a value into pixels; a zero-width domain pins to the middle rather than dividing by zero. */
export function project(value: number, extent: Extent, size: number): number {
  const span = extent.max - extent.min;
  if (span === 0) return size / 2;
  return ((value - extent.min) / span) * size;
}

/**
 * The four corners of the data, labelled.
 *
 * Labelling every point would be unreadable and labelling none leaves a cloud
 * nobody can anchor. The extremes are what a reader looks for first — which
 * neighborhood is worst served, which has the highest rate — so those carry
 * their names and the rest stay anonymous.
 */
export function selectExtremes(points: readonly ScatterPoint[]): ScatterPoint[] {
  if (points.length === 0) return [];

  const by = (pick: (p: ScatterPoint) => number, highest: boolean): ScatterPoint =>
    [...points].sort((a, b) => (highest ? pick(b) - pick(a) : pick(a) - pick(b)))[0] as ScatterPoint;

  const candidates = [
    by((p) => p.y, true),
    by((p) => p.y, false),
    by((p) => p.x, true),
    by((p) => p.x, false),
  ];

  const seen = new Set<string>();
  return candidates.filter((point) => {
    if (seen.has(point.nta2020)) return false;
    seen.add(point.nta2020);
    return true;
  });
}

/** Keeps a label inside the plot, so an extreme at the edge is not clipped away. */
export function clampLabelAnchor(
  x: number,
  width: number,
  labelWidth = 70,
): 'start' | 'middle' | 'end' {
  if (x < labelWidth / 2) return 'start';
  if (x > width - labelWidth / 2) return 'end';
  return 'middle';
}
