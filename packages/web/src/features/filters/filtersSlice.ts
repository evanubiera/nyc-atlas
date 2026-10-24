import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  DEFAULT_VISIBLE_CATEGORIES,
  type CrimeCategory,
  type ExposureMeasure,
  type InstitutionScope,
} from '@nyc-atlas/shared';

export interface FiltersState {
  categories: CrimeCategory[];
  exposure: ExposureMeasure;
  institutionScope: InstitutionScope;
  boroughCodes: number[];
  residentialOnly: boolean;
  showInstitutions: boolean;
  extrude: boolean;
}

const initialState: FiltersState = {
  categories: [...DEFAULT_VISIBLE_CATEGORIES],
  exposure: 'DENSITY',
  institutionScope: 'STANDARD',
  boroughCodes: [],
  residentialOnly: true,
  showInstitutions: true,
  extrude: true,
};

const filtersSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    toggleCategory(state, action: PayloadAction<CrimeCategory>) {
      const i = state.categories.indexOf(action.payload);
      if (i >= 0) state.categories.splice(i, 1);
      else state.categories.push(action.payload);
    },
    setExposure(state, action: PayloadAction<ExposureMeasure>) {
      state.exposure = action.payload;
    },
    setInstitutionScope(state, action: PayloadAction<InstitutionScope>) {
      state.institutionScope = action.payload;
    },
    toggleBorough(state, action: PayloadAction<number>) {
      const i = state.boroughCodes.indexOf(action.payload);
      if (i >= 0) state.boroughCodes.splice(i, 1);
      else state.boroughCodes.push(action.payload);
    },
    setResidentialOnly(state, action: PayloadAction<boolean>) {
      state.residentialOnly = action.payload;
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
  toggleCategory,
  setExposure,
  setInstitutionScope,
  toggleBorough,
  setResidentialOnly,
  setShowInstitutions,
  setExtrude,
} = filtersSlice.actions;

export default filtersSlice.reducer;
