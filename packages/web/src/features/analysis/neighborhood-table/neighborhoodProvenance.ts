import { DATASETS } from '@nyc-atlas/shared';
import type { NeighborhoodMetric } from '../../../store/atlasApi.js';

/**
 * Where one neighborhood's numbers came from, and which of them are absent
 * (specs/008 §7.2).
 *
 * The limitations panel cites the sources for the city as a whole, but
 * coverage is not uniform: a neighborhood with no inspected food store and
 * one with an 87% pass rate both render as a cell, and only this says which
 * is which. An empty measure is reported as a source that had nothing for
 * this neighborhood, not as a missing source.
 */

export interface MeasureProvenance {
  measure: string;
  source: string;
  datasetId: string;
  /** What this neighborhood actually has, or why the cell is empty. */
  detail: string;
  present: boolean;
}

function outcomeDataset(category: string): { id: string; name: string } {
  return category === 'SHOOTING' ? DATASETS.shootings : DATASETS.complaintsCurrent;
}

export function neighborhoodProvenance(
  row: NeighborhoodMetric,
  category: string,
): MeasureProvenance[] {
  const outcome = outcomeDataset(category);

  return [
    {
      measure: 'Incidents',
      source: outcome.name,
      datasetId: outcome.id,
      detail:
        row.ratePer100k === null
          ? `${row.rawCount} recorded — no rate without a population denominator`
          : `${row.rawCount} recorded`,
      present: true,
    },
    {
      measure: 'Population & income',
      source: 'ACS 5-year estimates',
      datasetId: 'api.census.gov',
      detail:
        row.population === null
          ? 'No ACS estimate for this neighborhood'
          : `${row.population.toLocaleString()} residents; median income is a ` +
            'population-weighted mean of tract medians, not a true median',
      present: row.population !== null,
    },
    {
      measure: 'Cultural institutions',
      source: `${DATASETS.culturalOrgsDcla.name} ∪ ${DATASETS.facilities.name}`,
      datasetId: `${DATASETS.culturalOrgsDcla.id}, ${DATASETS.facilities.id}`,
      detail:
        row.institutionCount === 0
          ? 'None at the selected scope'
          : `${row.institutionCount} after cross-source de-duplication`,
      present: row.institutionCount > 0,
    },
    {
      measure: 'Groceries',
      source: DATASETS.retailFoodStores.name,
      datasetId: DATASETS.retailFoodStores.id,
      detail:
        row.foodStoreCount === 0
          ? 'No licensed food store here'
          : `${row.supermarketCount} of ${row.foodStoreCount} licensed stores clear ` +
            '10,000 sq ft, self-reported at licensing',
      present: row.foodStoreCount > 0,
    },
    {
      measure: 'Store grades',
      source: DATASETS.foodSafetyInspections.name,
      datasetId: DATASETS.foodSafetyInspections.id,
      detail:
        row.gradedStoreCount === 0
          ? 'No store here has a current inspection on file'
          : `${row.gradeAStoreCount} of ${row.gradedStoreCount} inspected stores hold the ` +
            'top grade — sanitation, not what the store sells',
      present: row.gradedStoreCount > 0,
    },
    {
      measure: 'Schools',
      source: DATASETS.schoolQuality.name,
      datasetId: DATASETS.schoolQuality.id,
      detail:
        row.schoolProficiency === null
          ? 'No elementary or middle school here published 2024 proficiency'
          : `${row.schoolCount} schools, ${row.schoolStudents.toLocaleString()} students ` +
            'tested — where the schools are, not where the pupils live',
      present: row.schoolProficiency !== null,
    },
    {
      measure: 'Healthcare',
      source: DATASETS.facilities.name,
      datasetId: DATASETS.facilities.id,
      detail:
        row.healthcareSiteCount === 0
          ? 'No hospital, clinic or diagnostic centre here'
          : `${row.healthcareSiteCount} sites — doors, not capacity or accepted insurance`,
      present: row.healthcareSiteCount > 0,
    },
  ];
}
