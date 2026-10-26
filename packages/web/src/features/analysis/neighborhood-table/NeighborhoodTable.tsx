import { useMemo, useState } from 'react';
import {
  useInstitutionsQuery,
  useMetricsQuery,
  type InstitutionPoint,
  type MetricsInput,
  type NeighborhoodMetric,
} from '../../../store/atlasApi.js';
import { labelFor, TABLE_COLUMNS } from './columns.ts';
import { groupInstitutionsByNeighborhood } from './institutions.ts';
import { NeighborhoodMetricRow } from './NeighborhoodMetricRow.tsx';
import { NeighborhoodTableHeader } from './NeighborhoodTableHeader.tsx';
import {
  nextSortState,
  sortNeighborhoods,
  withUsableRate,
  type SortKey,
  type SortState,
} from './sorting.ts';
import { Caption, Count, Empty, Head, Scroller, Table, Wrap } from './tableStyles.ts';

const INITIAL_SORT: SortState = { key: 'institutionCount', descending: true };

function TableCaption({
  rowCount,
  sort,
}: {
  rowCount: number;
  sort: SortState;
}): JSX.Element {
  return (
    <Head>
      <Caption>Every neighborhood</Caption>
      <Count>
        {rowCount} with a usable rate · sorted by {labelFor(sort.key).toLowerCase()}
      </Count>
    </Head>
  );
}

function TableBody({
  rows,
  institutionsByNta,
  expandedNta,
  onToggle,
}: {
  rows: NeighborhoodMetric[];
  institutionsByNta: Map<string, InstitutionPoint[]>;
  expandedNta: string | null;
  onToggle: (nta2020: string) => void;
}): JSX.Element {
  return (
    <tbody>
      {rows.map((row) => (
        <NeighborhoodMetricRow
          key={row.nta2020}
          row={row}
          institutions={institutionsByNta.get(row.nta2020) ?? []}
          isExpanded={expandedNta === row.nta2020}
          onToggle={() => onToggle(row.nta2020)}
        />
      ))}
    </tbody>
  );
}

/**
 * Every neighborhood on one sortable table: the socioeconomic columns and the
 * cultural-institution count side by side, with each count expanding to the
 * institutions behind it.
 *
 * This is also the table view the color scales owe the reader — every value the
 * map and the gap panel encode is legible here as a number.
 */
export function NeighborhoodTable({ input }: { input: MetricsInput }): JSX.Element {
  const { data } = useMetricsQuery(input);
  const { data: institutions } = useInstitutionsQuery({ scope: input.scope });

  const [sort, setSort] = useState<SortState>(INITIAL_SORT);
  const [expandedNta, setExpandedNta] = useState<string | null>(null);

  const institutionsByNta = useMemo(
    () => groupInstitutionsByNeighborhood(institutions ?? []),
    [institutions],
  );

  const rows = useMemo(
    () => sortNeighborhoods(withUsableRate(data?.rows ?? []), sort),
    [data?.rows, sort],
  );

  const handleSort = (key: SortKey): void => setSort((current) => nextSortState(current, key));
  const toggleExpanded = (nta2020: string): void =>
    setExpandedNta((current) => (current === nta2020 ? null : nta2020));

  return (
    <Wrap>
      <TableCaption rowCount={rows.length} sort={sort} />

      <Scroller>
        <Table>
          <colgroup>
            {TABLE_COLUMNS.map((column) => (
              <col key={column.key} style={{ width: column.width }} />
            ))}
          </colgroup>

          <NeighborhoodTableHeader sort={sort} onSort={handleSort} />

          <TableBody
            rows={rows}
            institutionsByNta={institutionsByNta}
            expandedNta={expandedNta}
            onToggle={toggleExpanded}
          />
        </Table>

        {rows.length === 0 && (
          <Empty>No neighborhoods have a usable rate for this selection.</Empty>
        )}
      </Scroller>
    </Wrap>
  );
}
