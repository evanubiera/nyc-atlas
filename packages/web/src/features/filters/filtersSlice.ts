import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CrimeCategory, ExposureMeasure, InstitutionScope } from '@nyc-atlas/shared';

/** What the choropleth encodes. */
export type MapMode = 'OUTCOME' | 'RESIDUAL' | 'BIVARIATE';

export interface FiltersState {
  category: CrimeCategory;
  exposure: ExposureMeasure;
  institutionScope: InstitutionScope;
  boroughCodes: number[];
  from: string;
  to: string;
  mapMode: MapMode;
  showInstitutions: boolean;
  extrude: boolean;
}

/** Also the baseline the URL encoder diffs against — see filtersUrl.ts. */
export const DEFAULT_FILTERS: FiltersState = {
  category: 'SHOOTING',
  exposure: 'PER_CAPITA',
  institutionScope: 'STANDARD',
  boroughCodes: [],
  from: '2006-01',
  to: '2026-12',
  mapMode: 'OUTCOME',
  showInstitutions: true,
  extrude: true,
};

const filtersSlice = createSlice({
  name: 'filters',
  initialState: DEFAULT_FILTERS,
  reducers: {
    /** Applies a whole state at once, as a decoded URL or a back button does. */
    replaceFilters(_state, action: PayloadAction<FiltersState>) {
      return action.payload;
    },
    setCategory(state, action: PayloadAction<CrimeCategory>) {
      state.category = action.payload;
    },
    setExposure(state, action: PayloadAction<ExposureMeasure>) {
      state.exposure = action.payload;
    },
    setInstitutionScope(state, action: PayloadAction<InstitutionScope>) {
      state.institutionScope = action.payload;
    },
    setMapMode(state, action: PayloadAction<MapMode>) {
      state.mapMode = action.payload;
    },
    toggleBorough(state, action: PayloadAction<number>) {
      const i = state.boroughCodes.indexOf(action.payload);
      if (i >= 0) state.boroughCodes.splice(i, 1);
      else state.boroughCodes.push(action.payload);
    },
    setRange(state, action: PayloadAction<{ from: string; to: string }>) {
      state.from = action.payload.from;
      state.to = action.payload.to;
    },
    setShowInstitutions(state, action: PayloadAction<boolean>) {
      state.showInstitutions = action.payload;
    },
    setExtrude(state, action: PayloadAction<boolean>) {
      state.extrude = action.payload;
    },
  },
});

export const {
  replaceFilters,
  setCategory,
  setExposure,
  setInstitutionScope,
  setMapMode,
  toggleBorough,
  setRange,
  setShowInstitutions,
  setExtrude,
} = filtersSlice.actions;

export default filtersSlice.reducer;
