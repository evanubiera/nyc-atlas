import type { InstitutionPoint, NeighborhoodMetric } from '../../../store/atlasApi.js';
import { TABLE_COLUMNS } from './columns.ts';
import { InstitutionList } from './InstitutionList.tsx';
import { NeighborhoodNameCell, SocioeconomicCells } from './MetricCells.tsx';
import { NeighborhoodProvenance } from './NeighborhoodProvenance.tsx';
import { Chevron, Disclosure, Num, PanelCell, Tr, Zero } from './tableStyles.ts';

interface NeighborhoodMetricRowProps {
  row: NeighborhoodMetric;
  institutions: InstitutionPoint[];
  category: string;
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Brings a newly opened panel into view. Expanding the last visible row
 * otherwise reveals a list entirely below the fold.
 */
function scrollIntoView(node: HTMLTableCellElement | null): void {
  node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function expandTitle(row: NeighborhoodMetric, hasInstitutions: boolean): string {
  if (!hasInstitutions) return 'Show where this neighborhood’s numbers come from';
  return `List all ${row.institutionCount}, and where the numbers come from`;
}

function InstitutionCell({
  row,
  hasInstitutions,
  isExpanded,
  panelId,
  onToggle,
}: {
  row: NeighborhoodMetric;
  hasInstitutions: boolean;
  isExpanded: boolean;
  panelId: string;
  onToggle: () => void;
}): JSX.Element {
  return (
    <Num>
      <Disclosure
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        title={isExpanded ? 'Collapse' : expandTitle(row, hasInstitutions)}
      >
        <Chevron aria-hidden="true" $open={isExpanded} />
        {hasInstitutions ? (
          row.institutionCount
        ) : (
          <Zero title="No cultural institutions at this scope">0</Zero>
        )}
      </Disclosure>
    </Num>
  );
}

export function NeighborhoodMetricRow({
  row,
  institutions,
  category,
  isExpanded,
  onToggle,
}: NeighborhoodMetricRowProps): JSX.Element {
  const panelId = `detail-${row.nta2020}`;
  const hasInstitutions = row.institutionCount > 0 || institutions.length > 0;

  return (
    <>
      <Tr $expanded={isExpanded}>
        <NeighborhoodNameCell row={row} />
        <SocioeconomicCells row={row} />
        <InstitutionCell
          row={row}
          hasInstitutions={hasInstitutions}
          isExpanded={isExpanded}
          panelId={panelId}
          onToggle={onToggle}
        />
      </Tr>

      {isExpanded && (
        <tr>
          <PanelCell colSpan={TABLE_COLUMNS.length} id={panelId} ref={scrollIntoView}>
            {hasInstitutions && (
              <InstitutionList
                neighborhoodName={row.name}
                reportedCount={row.institutionCount}
                institutions={institutions}
              />
            )}
            <NeighborhoodProvenance row={row} category={category} divided={hasInstitutions} />
          </PanelCell>
        </tr>
      )}
    </>
  );
}
