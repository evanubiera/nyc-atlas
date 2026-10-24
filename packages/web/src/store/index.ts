import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { atlasApi } from './atlasApi.js';
import filtersReducer from '../features/filters/filtersSlice.js';

export const store = configureStore({
  reducer: {
    [atlasApi.reducerPath]: atlasApi.reducer,
    filters: filtersReducer,
  },
  middleware: (getDefault) => getDefault().concat(atlasApi.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
