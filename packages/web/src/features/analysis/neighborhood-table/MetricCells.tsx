import type { NeighborhoodMetric } from '../../../store/atlasApi.js';
import {
  formatCompactCurrency,
  formatPercent,
  formatRate,
  pluralize,
} from '../../../format/values.ts';
import { Meta, Name, Num, Td } from './tableStyles.ts';

function groceryTooltip(row: NeighborhoodMetric): string {
  return `${pluralize(row.supermarketCount, 'supermarket')} of ${pluralize(
    row.foodStoreCount,
    'licensed food store',
  )}`;
}

function storeGradeTooltip(row: NeighborhoodMetric): string {
  if (row.storeGradeShare === null) {
    return 'No food store here has a current inspection on file';
  }
  return `${row.gradeAStoreCount} of ${pluralize(
    row.gradedStoreCount,
    'inspected store',
  )} hold the top grade`;
}

function schoolTooltip(row: NeighborhoodMetric): string {
  if (row.schoolProficiency === null) {
    return 'No elementary or middle school here published 2024 proficiency';
  }
  return `${pluralize(row.schoolCount, 'school')}, ${pluralize(
    row.schoolStudents,
    'student',
  )} tested`;
}

export function NeighborhoodNameCell({ row }: { row: NeighborhoodMetric }): JSX.Element {
  return (
    <Td>
      <Name>{row.name}</Name>
      <Meta>
        {row.boroughName}
        {row.population !== null && ` · ${pluralize(row.population, 'resident')}`}
      </Meta>
    </Td>
  );
}

export function SocioeconomicCells({ row }: { row: NeighborhoodMetric }): JSX.Element {
  return (
    <>
      <Num title={row.medianHouseholdIncome === null ? 'No ACS income estimate' : undefined}>
        {formatCompactCurrency(row.medianHouseholdIncome)}
      </Num>

      <Num title={groceryTooltip(row)}>{formatRate(row.supermarketsPer10k)}</Num>

      <Num title={storeGradeTooltip(row)}>{formatPercent(row.storeGradeShare)}</Num>

      <Num title={schoolTooltip(row)}>{formatPercent(row.schoolProficiency)}</Num>

      <Num title={pluralize(row.healthcareSiteCount, 'site')}>
        {formatRate(row.healthcareSitesPer10k)}
      </Num>
    </>
  );
}
