import {
  DARK,
  FONT_STACK,
  GAP_DUMBBELL,
  LIGHT,
  SEQUENTIAL_BLUE,
  type ModeTokens,
} from '@nyc-atlas/shared';

export interface AppTheme extends ModeTokens {
  mode: 'light' | 'dark';
  font: string;
  sequential: readonly string[];
  /** The two ends of the access-gap dumbbell. One hue, two shades. */
  gap: { least: string; most: string };
  /** Token-free basemap. No Mapbox key required (specs/001 NFR-4). */
  basemapStyle: string;
  radius: { sm: string; md: string; lg: string };
  space: (n: number) => string;
}

const CARTO_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const CARTO_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const shared = {
  font: FONT_STACK,
  sequential: SEQUENTIAL_BLUE,
  radius: { sm: '4px', md: '8px', lg: '12px' },
  space: (n: number) => `${n * 4}px`,
};

export const lightTheme: AppTheme = {
  ...LIGHT,
  ...shared,
  mode: 'light',
  basemapStyle: CARTO_LIGHT,
  gap: { ...GAP_DUMBBELL.light },
};

export const darkTheme: AppTheme = {
  ...DARK,
  ...shared,
  mode: 'dark',
  basemapStyle: CARTO_DARK,
  gap: { ...GAP_DUMBBELL.dark },
};

/** Dark mode is selected, not an automatic flip — see specs/006. */
export function resolveTheme(mode: 'light' | 'dark'): AppTheme {
  return mode === 'dark' ? darkTheme : lightTheme;
}
