/**
 * Design tokens. Every categorical value here was validated with the data-viz
 * palette validator in BOTH modes on the all-pairs pairlist (choropleth and
 * scatter are all-pairs forms, which caps the series count at three):
 *
 *   light — CVD ΔE 9.2 worst pair, normal-vision 24.0  → PASS
 *   dark  — CVD ΔE 9.4 worst pair, normal-vision 20.9  → PASS
 *
 * One caveat carried forward: light-mode SERIES_3 (#1baf7a) measures 2.74:1
 * against the light surface, below the 3:1 bar. The relief rule applies —
 * wherever it appears it needs visible direct labels or the table view, and may
 * never carry meaning by hue alone. See specs/006-visualization.md.
 */

export interface ModeTokens {
  readonly surface: string;
  readonly pagePlane: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly gridline: string;
  readonly baseline: string;
  readonly border: string;
  readonly series: readonly [string, string, string];
  readonly divergingNeutral: string;
}

export const LIGHT: ModeTokens = {
  surface: '#fcfcfb',
  pagePlane: '#f9f9f7',
  textPrimary: '#0b0b0b',
  textSecondary: '#52514e',
  textMuted: '#898781',
  gridline: '#e1e0d9',
  baseline: '#c3c2b7',
  border: 'rgba(11,11,11,0.10)',
  series: ['#2a78d6', '#eb6834', '#1baf7a'],
  divergingNeutral: '#f0efec',
};

export const DARK: ModeTokens = {
  surface: '#1a1a19',
  pagePlane: '#0d0d0d',
  textPrimary: '#f0efec',
  textSecondary: '#c3c2b7',
  textMuted: '#898781',
  gridline: '#2c2c2a',
  baseline: '#383835',
  border: 'rgba(255,255,255,0.10)',
  series: ['#3987e5', '#d95926', '#199e70'],
  divergingNeutral: '#383835',
};

/**
 * Sequential ramp for outcome magnitude: single hue, light → dark.
 *
 * Blue rather than red, deliberately. It is the system default for sequential
 * magnitude, and a red "heat map" of violence across neighborhoods where people
 * live reads as a threat map and invites exactly the moral reading that
 * specs/007-methodology.md §9 prohibits. Blue encodes magnitude without
 * encoding judgment.
 */
export const SEQUENTIAL_BLUE: readonly string[] = [
  '#cde2fb', // 100
  '#b7d3f6', // 150
  '#9ec5f4', // 200
  '#86b6ef', // 250
  '#6da7ec', // 300
  '#5598e7', // 350
  '#3987e5', // 400
  '#2a78d6', // 450
  '#256abf', // 500
  '#1c5cab', // 550
  '#184f95', // 600
  '#104281', // 650
  '#0d366b', // 700
];

/**
 * Diverging scale for the residual map (observed − predicted). Blue = fewer
 * incidents than the confounder model predicts, red = more, neutral gray at
 * zero. Equal steps per arm; no hue at the midpoint.
 */
export const DIVERGING_BLUE_RED = {
  low: ['#0d366b', '#1c5cab', '#2a78d6', '#86b6ef', '#cde2fb'],
  high: ['#f7d5d5', '#eda3a3', '#e34948', '#b82e2d', '#8a1f1e'],
} as const;

/** Reserved status colors — never reused as a series hue. Mode-invariant. */
export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const;

export const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Minimum contrast ratio a mark must clear before the relief rule kicks in. */
export const CONTRAST_RELIEF_THRESHOLD = 3;
