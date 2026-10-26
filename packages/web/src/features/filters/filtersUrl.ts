import { CRIME_CATEGORIES, type CrimeCategory } from '@nyc-atlas/shared';
import type { FiltersState, MapMode } from './filtersSlice.js';

/**
 * Filters <-> query string (specs/008 §4.3).
 *
 * A view of this atlas is an argument about a place, and an argument that
 * cannot be linked to cannot be checked. Both directions are needed: the URL
 * has to survive a reload and the back button, not just be written once.
 *
 * Anything unrecognised in the URL falls back to the default rather than
 * throwing. A link is user input — it gets edited, truncated by chat clients
 * and carried across deploys that renamed a value — and a broken parameter
 * should cost that one filter, not the page.
 */

const EXPOSURES = ['DENSITY', 'PER_CAPITA', 'ACCESS'] as const;
const SCOPES = ['NARROW', 'STANDARD', 'BROAD'] as const;
const MAP_MODES = ['OUTCOME', 'RESIDUAL', 'BIVARIATE'] as const;

/** `YYYY-MM`, the granularity the ingest aggregates to. */
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function oneOf<T extends string>(allowed: readonly T[], raw: string | null, fallback: T): T {
  return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

function month(raw: string | null, fallback: string): string {
  return raw !== null && MONTH.test(raw) ? raw : fallback;
}

function flag(raw: string | null, fallback: boolean): boolean {
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return fallback;
}

/** Borough codes are 1-5; anything else in the list is dropped, not rejected. */
function boroughs(raw: string | null): number[] {
  if (raw === null || raw === '') return [];
  const codes = raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((code) => Number.isInteger(code) && code >= 1 && code <= 5);
  return [...new Set(codes)].sort((a, b) => a - b);
}

export function decodeFilters(search: string, defaults: FiltersState): FiltersState {
  const params = new URLSearchParams(search);

  return {
    category: oneOf<CrimeCategory>(CRIME_CATEGORIES, params.get('category'), defaults.category),
    exposure: oneOf(EXPOSURES, params.get('exposure'), defaults.exposure),
    institutionScope: oneOf(SCOPES, params.get('scope'), defaults.institutionScope),
    boroughCodes: params.has('boroughs') ? boroughs(params.get('boroughs')) : defaults.boroughCodes,
    from: month(params.get('from'), defaults.from),
    to: month(params.get('to'), defaults.to),
    mapMode: oneOf<MapMode>(MAP_MODES, params.get('mode'), defaults.mapMode),
    showInstitutions: flag(params.get('institutions'), defaults.showInstitutions),
    extrude: flag(params.get('extrude'), defaults.extrude),
  };
}

/**
 * Only what differs from the defaults is written, so the unmodified view has a
 * bare URL and a shared link shows at a glance what was actually changed.
 */
export function encodeFilters(state: FiltersState, defaults: FiltersState): string {
  const params = new URLSearchParams();

  if (state.category !== defaults.category) params.set('category', state.category);
  if (state.exposure !== defaults.exposure) params.set('exposure', state.exposure);
  if (state.institutionScope !== defaults.institutionScope) {
    params.set('scope', state.institutionScope);
  }
  if (state.from !== defaults.from) params.set('from', state.from);
  if (state.to !== defaults.to) params.set('to', state.to);
  if (state.mapMode !== defaults.mapMode) params.set('mode', state.mapMode);
  if (state.showInstitutions !== defaults.showInstitutions) {
    params.set('institutions', state.showInstitutions ? '1' : '0');
  }
  if (state.extrude !== defaults.extrude) params.set('extrude', state.extrude ? '1' : '0');

  const sorted = [...state.boroughCodes].sort((a, b) => a - b);
  const defaultBoroughs = [...defaults.boroughCodes].sort((a, b) => a - b);
  if (sorted.join(',') !== defaultBoroughs.join(',')) params.set('boroughs', sorted.join(','));

  return params.toString();
}
