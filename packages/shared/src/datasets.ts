/**
 * Dataset registry. Every id, field name and row count below was verified
 * live against the Socrata API on 2026-10-24 by `npm run verify:sources`.
 * See specs/002-data-sources.md.
 */

export interface DatasetDescriptor {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  /** Fields the application depends on; verify:sources asserts their presence. */
  readonly requiredFields: readonly string[];
  readonly notes?: string;
}

export const SOCRATA_DOMAIN = 'data.cityofnewyork.us';

export const DATASETS = {
  ntaGeography: {
    id: '9nt8-h7nd',
    name: '2020 Neighborhood Tabulation Areas (NTAs)',
    purpose: 'The analytical geography. 262 features; 197 residential.',
    requiredFields: ['nta2020', 'ntaname', 'ntatype', 'boroname', 'borocode', 'cdta2020', 'shape_area'],
    notes: 'Full GeoJSON is 4.38 MB — must be simplified before transport. Filter ntatype = 0.',
  },
  complaintsCurrent: {
    id: '5uac-w243',
    name: 'NYPD Complaint Data Current (Year To Date)',
    purpose: 'Recent reported crime.',
    requiredFields: ['cmplnt_num', 'cmplnt_fr_dt', 'ofns_desc', 'law_cat_cd', 'boro_nm', 'latitude', 'longitude'],
    notes: 'No NTA field — requires spatial join. 58 rows have impossible dates (min 1016-04-30).',
  },
  complaintsHistoric: {
    id: 'qgea-i56i',
    name: 'NYPD Complaint Data Historic',
    purpose: 'Longitudinal reported crime, 2006–2019.',
    requiredFields: ['cmplnt_num', 'cmplnt_fr_dt', 'ofns_desc', 'law_cat_cd', 'boro_nm', 'latitude', 'longitude'],
    notes: 'ofns_desc truncation differs from the current dataset — see crime-categories.ts.',
  },
  shootings: {
    id: '5ucz-vwe8',
    name: 'Shootings (2006-Present)',
    purpose: 'PRIMARY outcome measure. 24,310 records.',
    requiredFields: ['incident_key', 'occur_date', 'boro', 'precinct', 'latitude', 'longitude'],
    notes: 'Replaces 833y-fsy8, which is now ARCHIVED. This set has 13 columns and drops victim/perp demographics.',
  },
  culturalOrgsDcla: {
    id: 'u35m-9t32',
    name: 'DCLA Cultural Organizations',
    purpose: 'Funded arts organizations. Has an `nta` field — no spatial join needed.',
    requiredFields: ['organization_name', 'discipline', 'borough', 'latitude', 'longitude', 'nta'],
    notes: 'Coverage skews to DCLA-funded orgs; under-counts informal cultural space, worst in low-income areas. 121 rows have null discipline.',
  },
  facilities: {
    id: 'ji82-xba5',
    name: 'Facilities Database (FacDB)',
    purpose: 'City facilities incl. libraries and cultural programs. Has nta2020.',
    requiredFields: ['uid', 'facname', 'facdomain', 'facgroup', 'facsubgrp', 'factype', 'nta2020', 'latitude', 'longitude'],
    notes: 'LIBRARIES AND CULTURAL PROGRAMS = 2,647 records; 83% lumped into OTHER CULTURAL INSTITUTIONS, so use factype for granularity.',
  },
  tractToNta: {
    id: 'hm78-6dwm',
    name: '2020 Census Tracts to 2020 NTAs and CDTAs Equivalency',
    purpose: 'Bridge from tract-level ACS data to NTA2020.',
    requiredFields: ['geoid', 'ct2020', 'ntacode', 'ntatype', 'boroname'],
  },
} as const satisfies Record<string, DatasetDescriptor>;

export type DatasetKey = keyof typeof DATASETS;

/** FacDB facdomain value for cultural facilities. */
export const FACDB_CULTURAL_DOMAIN = 'LIBRARIES AND CULTURAL PROGRAMS';

/** Additional domains included under the BROAD ("third places") institution scope. */
export const FACDB_BROAD_DOMAINS: readonly string[] = [
  FACDB_CULTURAL_DOMAIN,
  'PARKS, GARDENS, AND HISTORICAL SITES',
];

export const CENSUS_ACS_BASE = 'https://api.census.gov/data/2023/acs/acs5';
export const CENSUS_ACS_VINTAGE = '2023 ACS 5-year';

/**
 * ACS variables pulled at tract level and aggregated to NTA2020.
 * Counts sum; medians do NOT — they are approximated as population-weighted
 * means and flagged. See specs/002 §Socioeconomic.
 */
export const ACS_VARIABLES = {
  totalPopulation: 'B01003_001E',
  povertyUniverse: 'B17001_001E',
  povertyBelow: 'B17001_002E',
  medianHouseholdIncome: 'B19013_001E',
  tenureTotal: 'B25003_001E',
  tenureOwner: 'B25003_002E',
} as const;

export const CENSUS_KEY_SIGNUP_URL = 'https://api.census.gov/data/key_signup.html';
