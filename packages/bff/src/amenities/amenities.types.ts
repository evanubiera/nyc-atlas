import type { Nta2020Code } from '@nyc-atlas/shared';
import type { SocrataGeoreference } from '../common/geo-point.js';

/**
 * The three amenities this adds to the income picture, per neighborhood.
 *
 * Every field is a count or a share of something countable. There is no
 * composite "opportunity score" here on purpose: collapsing groceries, schools
 * and clinics into one index hides which of them is actually missing, and the
 * weights would be ours rather than the data's.
 */
export interface NtaAmenities {
  nta2020: Nta2020Code;

  foodStoreCount: number;
  supermarketCount: number;

  gradedStoreCount: number;
  gradeAStoreCount: number;
  /** Sanitation, not food quality. See FOOD_GRADES. Null when none inspected. */
  storeGradeShare: number | null;

  healthcareSiteCount: number;
  hospitalCount: number;

  schoolCount: number;
  schoolStudents: number;
  /** ELA and Math pooled, weighted by students tested. Null when none reported. */
  schoolProficiency: number | null;
}

export interface AmenitiesFetchResult {
  byNta: Map<Nta2020Code, NtaAmenities>;
  rejected: Map<string, number>;
  notes: string[];
}

export interface FoodStoreTally {
  total: number;
  supermarkets: number;
}

export interface StoreGradeTally {
  graded: number;
  passing: number;
}

export interface HealthcareTally {
  sites: number;
  hospitals: number;
}

export interface SchoolTally {
  schools: number;
  students: number;
  weightedProficiency: number;
}

export interface FoodStoreRow {
  license_number?: string;
  dba_name?: string;
  entity_name?: string;
  county?: string;
  square_footage?: string;
  georeference?: SocrataGeoreference | null;
}

export interface InspectionRow {
  county?: string;
  trade_name?: string;
  owner_name?: string;
  street?: string;
  inspection_grade?: string;
  inspection_date?: string;
  establishment_type?: string;
  georeference?: SocrataGeoreference | null;
}

export interface SchoolLocationRow {
  system_code?: string;
  location_name?: string;
  latitude?: string;
  longitude?: string;
  location_category_description?: string;
  grades_final_text?: string;
  status_descriptions?: string;
}

export interface SchoolQualityRow {
  dbn?: string;
  school_name?: string;
  metric_variable_name?: string;
  metric_value?: string;
  number_of_students?: string;
}

export interface FacDbHealthRow {
  uid?: string;
  facname?: string;
  factype?: string;
  nta2020?: string;
  latitude?: string;
  longitude?: string;
}

export function emptyAmenities(nta2020: Nta2020Code): NtaAmenities {
  return {
    nta2020,
    foodStoreCount: 0,
    supermarketCount: 0,
    gradedStoreCount: 0,
    gradeAStoreCount: 0,
    storeGradeShare: null,
    healthcareSiteCount: 0,
    hospitalCount: 0,
    schoolCount: 0,
    schoolStudents: 0,
    schoolProficiency: null,
  };
}
