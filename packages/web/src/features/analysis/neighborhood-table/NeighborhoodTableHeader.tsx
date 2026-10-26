import { TABLE_COLUMNS } from './columns.ts';
import type { SortKey, SortState } from './sorting.ts';
import { Arrow, SortButton, Th, Unit } from './tableStyles.ts';

interface NeighborhoodTableHeaderProps {
  sort: SortState;
  onSort: (key: SortKey) => void;
}

function ariaSortFor(sort: SortState, key: SortKey): 'ascending' | 'descending' | 'none' {
  if (sort.key !== key) return 'none';
  return sort.descending ? 'descending' : 'ascending';
}

function arrowFor(sort: SortState, key: SortKey): string {
  if (sort.key !== key) return '';
  return sort.descending ? '▾' : '▴';
}

export function NeighborhoodTableHeader({
  sort,
  onSort,
}: NeighborhoodTableHeaderProps): JSX.Element {
  return (
    <thead>
      <tr>
        {TABLE_COLUMNS.map((column) => (
          <Th
            key={column.key}
            $numeric={column.numeric}
            title={column.title}
            aria-sort={ariaSortFor(sort, column.key)}
          >
            <SortButton
              type="button"
              $numeric={column.numeric}
              onClick={() => onSort(column.key)}
            >
              <span>
                {column.label}
                <Arrow aria-hidden="true">{arrowFor(sort, column.key)}</Arrow>
              </span>
              {column.unit !== undefined && <Unit>{column.unit}</Unit>}
            </SortButton>
          </Th>
        ))}
      </tr>
    </thead>
  );
}
