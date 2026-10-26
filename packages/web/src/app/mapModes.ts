import type { MapMode } from '../features/filters/filtersSlice.js';

export interface MapModeOption {
  value: MapMode;
  label: string;
  hint: string;
}

export const MAP_MODES: MapModeOption[] = [
  {
    value: 'OUTCOME',
    label: 'Crime rate',
    hint: 'Sequential: magnitude of the outcome.',
  },
  {
    value: 'RESIDUAL',
    label: 'vs. predicted',
    hint:
      'Diverging: observed minus what income, poverty, density, age and tenure predict. ' +
      'Red means more incidents than socioeconomics alone explain.',
  },
  {
    value: 'BIVARIATE',
    label: 'Access × crime',
    hint: 'Both axes at once. The deepest red is low cultural access with high crime.',
  },
];

export const INSTITUTION_SCOPES = [
  { value: 'NARROW', label: 'DCLA arts orgs' },
  { value: 'STANDARD', label: '+ libraries & museums' },
  { value: 'BROAD', label: '+ parks & historic sites' },
] as const;

export const EXPOSURE_MEASURES = [
  { value: 'PER_CAPITA', label: 'per 10k residents' },
  { value: 'DENSITY', label: 'per km²' },
] as const;
