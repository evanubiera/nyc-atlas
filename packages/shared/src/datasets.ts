/**
 * Every id, field name and row count below was verified live against the
 * Socrata API on 2026-10-24 by `npm run verify:sources`.
 * See specs/002-data-sources.md.
 */

export interface DatasetDescriptor {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  /** Fields the application depends on; verify:sources asserts their presence. */
  readonly requiredFields: readonly string[];
  /**
   * Socrata host, when it is not NYC Open Data. Food retail is licensed by the
   * State, so the only citywide store inventory lives on data.ny.gov.
   */
  readonly domain?: string;
  readonly notes?: string;
}

export const SOCRATA_DOMAIN = 'data.cityofnewyork.us';
export const NYS_SOCRATA_DOMAIN = 'data.ny.gov';

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
  retailFoodStores: {
    id: '9a8c-vfzj',
    domain: NYS_SOCRATA_DOMAIN,
    name: 'Retail Food Stores (NYS Dept. of Agriculture & Markets)',
    purpose: 'Grocery access. 11,159 licensed stores in the five counties.',
    requiredFields: ['license_number', 'county', 'entity_name', 'dba_name', 'square_footage', 'georeference'],
    notes:
      'Food retail is licensed by the State, so this is the only citywide store inventory — ' +
      'it lives on a different Socrata host. square_footage is self-reported at licensing and ' +
      'visibly noisy (a donut shop claims 20,000 sq ft). No NTA field; 227 NYC rows have no ' +
      'georeference and cannot be placed.',
  },
  foodSafetyInspections: {
    id: 'd6dy-3h7r',
    domain: NYS_SOCRATA_DOMAIN,
    name: 'Food Safety Inspections – Current Ratings (NYS Ag & Markets)',
    purpose: 'Grocery quality. The inspection grade behind each food store.',
    requiredFields: [
      'county', 'trade_name', 'owner_name', 'street',
      'inspection_grade', 'inspection_date', 'establishment_type', 'georeference',
    ],
    notes:
      'One row per deficiency, not per establishment, so a badly graded store contributes many ' +
      'rows and a clean one contributes a single row — counting rows would invert the measure. ' +
      'Dedupe to the most recent inspection per owner+trade+street first. Spells the counties in ' +
      'Title Case where the store licence file shouts them, hence upper() in the filter. ' +
      '94,910 NYC rows resolve to 11,766 establishments; 99.3% carry a georeference.',
  },
  schoolQuality: {
    id: 'dnpx-dfnc',
    name: 'School Quality Reports Data',
    purpose: 'School outcomes. Share of students at NY State Level 3-4 in ELA and Math.',
    requiredFields: [
      'school_year', 'report_type', 'dbn', 'school_name',
      'metric_variable_name', 'metric_value', 'number_of_students',
    ],
    notes:
      'Long format: one row per school per metric per year. Carries a DBN and no coordinates, ' +
      'so it needs schoolLocations to reach a neighborhood.',
  },
  schoolLocations: {
    id: 'wg9x-4ke6',
    name: '2019 - 2020 School Locations',
    purpose: 'DBN to coordinates, so school outcomes can be placed in a neighborhood.',
    requiredFields: [
      'system_code', 'location_name', 'latitude', 'longitude',
      'location_category_description', 'grades_final_text', 'status_descriptions',
    ],
    notes:
      'system_code is the DBN. Its `nta` field is a 2010 code and is ignored — coordinates are ' +
      'spatially joined to 2020 NTAs instead. 2019-20 is the newest published vintage; 97.4% of ' +
      'schools with 2024 quality data match, the rest being mostly post-2020 charters.',
  },
  censusTracts: {
    id: '63ge-mke6',
    name: '2020 Census Tracts',
    purpose:
      'Tract geometry for walkable access. Carries nta2020 directly, so no crosswalk is ' +
      'needed to roll tract-level reach up to a neighborhood.',
    requiredFields: ['the_geom', 'geoid', 'nta2020', 'boroname'],
    notes:
      'Used only for centroids. Walkable access is measured around where people live ' +
      'rather than around the neighborhood as a whole.',
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

/**
 * Most recent published ACS 5-year release. Verified available 2026-10-24;
 * 2025 returns 404. Probe before bumping — an unpublished vintage returns a
 * misleading `invalid_key` redirect rather than a 404.
 */
export const CENSUS_ACS_BASE = 'https://api.census.gov/data/2024/acs/acs5';
export const CENSUS_ACS_VINTAGE = '2024 ACS 5-year';

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

/**
 * Floor area at which a food store is treated as a full-service supermarket
 * rather than a corner store.
 *
 * 10,000 sq ft is the conventional line in NYC food-access work (it is the
 * threshold the city's own FRESH program and USDA food-desert analyses use).
 * It is a proxy: floor area is a decent predictor of fresh produce, dairy and
 * meat depth, not a measurement of it.
 */
export const SUPERMARKET_MIN_SQFT = 10_000;

/** NYS county names for the five boroughs, as the food-store licence file spells them. */
export const NYC_COUNTY_NAMES: readonly string[] = [
  'NEW YORK',
  'KINGS',
  'QUEENS',
  'BRONX',
  'RICHMOND',
];

/**
 * Deliberately narrow: this subgroup is where care is actually delivered
 * (hospitals, diagnostic and treatment centers, extension and child-health
 * clinics). The sibling
 * 'OTHER HEALTH CARE' subgroup is mostly adult homes, home-care agencies and
 * City Council demonstration grants — real services, but not places a resident
 * can walk into for care, so counting them would overstate access.
 */
export const FACDB_HEALTHCARE_SUBGROUP = 'HOSPITALS AND CLINICS';

/**
 * Residential programs that FacDB files under HOSPITALS AND CLINICS. They are
 * housing, not care access, and are excluded from the healthcare count.
 */
export const FACDB_HEALTHCARE_EXCLUDED_TYPES: readonly string[] = [
  'ENRICHED HOUSING PROGRAM',
  'HOSPITAL RESIDENTIAL STRUCTURE',
];

/** School-quality metrics pulled from the School Quality Reports. */
export const SCHOOL_PROFICIENCY_METRICS = {
  ela: 'prof_pct_ela_all',
  math: 'prof_pct_mth_all',
} as const;

/**
 * Newest School Quality Reports year carrying elementary/middle proficiency.
 * Verified available 2026-10-24.
 */
export const SCHOOL_QUALITY_YEAR = 2024;

/** Report type carrying ELA/Math proficiency: elementary and middle schools. */
export const SCHOOL_QUALITY_REPORT_TYPE = 'EMS';

/**
 * Food-store inspection grades, best first.
 *
 * This is a **sanitation** grade from the State's retail food inspectors. It
 * says whether a store is clean and storing food safely. It says nothing about
 * whether the produce is fresh, the prices are fair, or the shelves carry
 * anything green — which is what "a good grocery store" usually means. It is
 * the only store-level rating published citywide, and it is labelled for what
 * it measures everywhere it appears.
 */
export const FOOD_GRADES = ['A', 'B', 'C'] as const;
export type FoodGrade = (typeof FOOD_GRADES)[number];

/** The grade treated as "passed cleanly". 85.7% of NYC stores hold it. */
export const FOOD_GRADE_PASS: FoodGrade = 'A';
