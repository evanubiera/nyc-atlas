import { DIVERGING_BLUE_RED, SEQUENTIAL_BLUE } from '@nyc-atlas/shared';

export type Rgba = [number, number, number, number];

export function hexToRgba(hex: string, alpha = 255): Rgba {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return [128, 128, 128, alpha];
  return [
    parseInt(m[1] as string, 16),
    parseInt(m[2] as string, 16),
    parseInt(m[3] as string, 16),
    alpha,
  ];
}

/**
 * Sequential magnitude: one hue, light to dark, stepped by server-computed
 * quantile breaks so the map, the legend and any chart agree.
 */
export function sequentialColor(value: number, breaks: readonly number[], alpha = 200): Rgba {
  const ramp = SEQUENTIAL_BLUE;
  if (breaks.length === 0) return hexToRgba(ramp[6] as string, alpha);

  let bucket = 0;
  while (bucket < breaks.length && value > (breaks[bucket] as number)) bucket += 1;

  const idx = Math.round((bucket / breaks.length) * (ramp.length - 4)) + 3;
  return hexToRgba(ramp[Math.min(idx, ramp.length - 1)] as string, alpha);
}

/**
 * Diverging polarity for residuals: blue = fewer incidents than the confounder
 * model predicts, red = more, neutral gray at zero. Equal steps per arm and no
 * hue at the midpoint.
 */
export function divergingColor(value: number, extent: number, neutral: string, alpha = 205): Rgba {
  if (extent <= 0 || !Number.isFinite(value)) return hexToRgba(neutral, alpha);

  const t = Math.max(-1, Math.min(1, value / extent));
  const arm = t < 0 ? DIVERGING_BLUE_RED.low : DIVERGING_BLUE_RED.high;
  const magnitude = Math.abs(t);

  if (magnitude < 0.12) return hexToRgba(neutral, alpha);

  const steps = arm.length;
  const i = Math.min(steps - 1, Math.floor(magnitude * steps));
  const hex = t < 0 ? arm[steps - 1 - i] : arm[i];
  return hexToRgba(hex as string, alpha);
}

/**
 * Bivariate 3x3: exposure on one axis, outcome on the other.
 *
 * The cell that matters for the research question — low cultural access AND
 * high crime — gets the most saturated color, so those neighborhoods are
 * directly identifiable rather than inferred by comparing two maps.
 */
const BIVARIATE_GRID: readonly (readonly string[])[] = [
  ['#e8e6df', '#d98f8f', '#b02f2f'],
  ['#a8c7e8', '#9f91b5', '#8f4a6b'],
  ['#2a78d6', '#4a6bb5', '#5c4a8f'],
];

export function bivariateColor(
  exposureTercile: 0 | 1 | 2,
  outcomeTercile: 0 | 1 | 2,
  alpha = 210,
): Rgba {
  const row = BIVARIATE_GRID[exposureTercile] as readonly string[];
  return hexToRgba(row[outcomeTercile] as string, alpha);
}

export const BIVARIATE_LEGEND = BIVARIATE_GRID;

/** Assigns a value to a tercile given two cut points. */
export function tercile(value: number, cuts: readonly [number, number]): 0 | 1 | 2 {
  if (value <= cuts[0]) return 0;
  if (value <= cuts[1]) return 1;
  return 2;
}
