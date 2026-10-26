import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks.js';
import { DEFAULT_FILTERS, replaceFilters } from './filtersSlice.js';
import { decodeFilters, encodeFilters } from './filtersUrl.js';

/**
 * Keeps the filter state and the address bar in step (specs/008 §4.3).
 *
 * `replaceState` rather than `pushState`: every toggle of the extrusion
 * switch would otherwise become a history entry, and the back button would
 * walk through them one at a time instead of leaving the page. popstate is
 * still handled, so a link opened into an already-running app applies.
 */
export function useFilterUrlSync(): void {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((state) => state.filters);
  const isFirstWrite = useRef(true);

  useEffect(() => {
    const applyFromUrl = (): void => {
      dispatch(replaceFilters(decodeFilters(window.location.search, DEFAULT_FILTERS)));
    };

    applyFromUrl();
    window.addEventListener('popstate', applyFromUrl);
    return () => window.removeEventListener('popstate', applyFromUrl);
  }, [dispatch]);

  useEffect(() => {
    // The first pass still holds the pre-hydration state; writing it would
    // erase the very parameters the effect above is about to apply.
    if (isFirstWrite.current) {
      isFirstWrite.current = false;
      return;
    }

    const query = encodeFilters(filters, DEFAULT_FILTERS);
    const next = query === '' ? window.location.pathname : `${window.location.pathname}?${query}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (next !== current) window.history.replaceState(null, '', next);
  }, [filters]);
}
