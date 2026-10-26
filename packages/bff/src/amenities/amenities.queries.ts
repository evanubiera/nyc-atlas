import {
  DATASETS,
  FACDB_HEALTHCARE_SUBGROUP,
  NYC_COUNTY_NAMES,
  SCHOOL_PROFICIENCY_METRICS,
  SCHOOL_QUALITY_REPORT_TYPE,
  SCHOOL_QUALITY_YEAR,
  type DatasetDescriptor,
} from '@nyc-atlas/shared';
import type { SocrataService, SoqlQuery } from '../socrata/socrata.service.js';
import type {
  FacDbHealthRow,
  FoodStoreRow,
  InspectionRow,
  SchoolLocationRow,
  SchoolQualityRow,
} from './amenities.types.js';

const SOCRATA_PAGE_LIMIT = 50_000;

function quotedList(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(',');
}

function hostOptions(dataset: DatasetDescriptor): Pick<SoqlQuery, 'domain'> {
  return dataset.domain === undefined ? {} : { domain: dataset.domain };
}

export function fetchFoodStoreLicences(socrata: SocrataService): Promise<FoodStoreRow[]> {
  const dataset = DATASETS.retailFoodStores;
  return socrata.query<FoodStoreRow>(dataset.id, {
    ...hostOptions(dataset),
    select: 'license_number, dba_name, entity_name, county, square_footage, georeference',
    where: `county in(${quotedList(NYC_COUNTY_NAMES)})`,
    limit: SOCRATA_PAGE_LIMIT,
  });
}

/**
 * The inspection file spells the counties in Title Case where the licence file
 * shouts them, so one constant serves both only through upper().
 */
export async function fetchFoodInspections(socrata: SocrataService): Promise<InspectionRow[]> {
  const dataset = DATASETS.foodSafetyInspections;
  const rows: InspectionRow[] = [];

  for await (const page of socrata.paginate<InspectionRow>(dataset.id, {
    ...hostOptions(dataset),
    select:
      'county, trade_name, owner_name, street, inspection_grade, inspection_date, georeference',
    where: `upper(county) in(${quotedList(NYC_COUNTY_NAMES)})`,
  })) {
    rows.push(...page);
  }

  return rows;
}

export function fetchHealthcareFacilities(socrata: SocrataService): Promise<FacDbHealthRow[]> {
  return socrata.query<FacDbHealthRow>(DATASETS.facilities.id, {
    select: 'uid, facname, factype, nta2020, latitude, longitude',
    where: `facsubgrp='${FACDB_HEALTHCARE_SUBGROUP}'`,
    limit: SOCRATA_PAGE_LIMIT,
  });
}

export function fetchSchoolLocations(socrata: SocrataService): Promise<SchoolLocationRow[]> {
  return socrata.query<SchoolLocationRow>(DATASETS.schoolLocations.id, {
    select:
      'system_code, location_name, latitude, longitude, ' +
      'location_category_description, grades_final_text, status_descriptions',
    limit: SOCRATA_PAGE_LIMIT,
  });
}

export function fetchSchoolProficiency(socrata: SocrataService): Promise<SchoolQualityRow[]> {
  const metrics = quotedList([
    SCHOOL_PROFICIENCY_METRICS.ela,
    SCHOOL_PROFICIENCY_METRICS.math,
  ]);

  return socrata.query<SchoolQualityRow>(DATASETS.schoolQuality.id, {
    select: 'dbn, school_name, metric_variable_name, metric_value, number_of_students',
    where:
      `school_year=${SCHOOL_QUALITY_YEAR} ` +
      `AND report_type='${SCHOOL_QUALITY_REPORT_TYPE}' ` +
      `AND metric_variable_name in(${metrics})`,
    limit: SOCRATA_PAGE_LIMIT,
  });
}
