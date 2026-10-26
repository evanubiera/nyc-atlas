import styled from 'styled-components';
import type { NeighborhoodMetric } from '../../../store/atlasApi.js';
import { neighborhoodProvenance } from './neighborhoodProvenance.ts';

/**
 * Where this one neighborhood's numbers came from (specs/008 §7.2).
 *
 * Sits under the institution list because the same question applies to every
 * column in the row, not just the count that opened the panel. Measures with
 * nothing to show are listed rather than hidden — an absent row is the part a
 * reader most needs to see, since on the map it is indistinguishable from a
 * low value.
 */
export function NeighborhoodProvenance({
  row,
  category,
  divided = true,
}: {
  row: NeighborhoodMetric;
  category: string;
  /** False when nothing precedes this block, so it does not open on a rule. */
  divided?: boolean;
}): JSX.Element {
  const entries = neighborhoodProvenance(row, category);

  return (
    <Wrap $divided={divided}>
      <Heading>Where these numbers come from</Heading>

      {row.excluded && (
        <Excluded>
          Excluded from the analysis — {row.excluded.explanation}
        </Excluded>
      )}

      <List>
        {entries.map((entry) => (
          <li key={entry.measure}>
            <Measure $present={entry.present}>{entry.measure}</Measure>
            <Detail>{entry.detail}</Detail>
            <Source>
              {entry.source} <Id>{entry.datasetId}</Id>
            </Source>
          </li>
        ))}
      </List>
    </Wrap>
  );
}

const Wrap = styled.div<{ $divided: boolean }>`
  margin-top: ${({ theme, $divided }) => ($divided ? theme.space(3) : '0')};
  padding-top: ${({ theme, $divided }) => ($divided ? theme.space(3) : '0')};
  border-top: ${({ theme, $divided }) =>
    $divided ? `1px solid ${theme.gridline}` : 'none'};
`;

const Heading = styled.h4`
  margin: 0 0 ${({ theme }) => theme.space(2)};
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.textMuted};
`;

const Excluded = styled.p`
  margin: 0 0 ${({ theme }) => theme.space(2)};
  font-size: 11px;
  color: ${({ theme }) => theme.textSecondary};
`;

const List = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: ${({ theme }) => theme.space(2)};
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 11px;
  line-height: 1.45;
`;

/**
 * An absent measure is dimmed rather than coloured or hidden: it still has to
 * be readable, and a warning hue here would compete with the caveat note.
 */
const Measure = styled.span<{ $present: boolean }>`
  display: block;
  font-weight: 600;
  color: ${({ theme, $present }) => ($present ? theme.textPrimary : theme.textMuted)};
`;

const Detail = styled.span`
  display: block;
  color: ${({ theme }) => theme.textSecondary};
`;

const Source = styled.span`
  display: block;
  margin-top: 2px;
  color: ${({ theme }) => theme.textMuted};
`;

const Id = styled.code`
  font-size: 10px;
`;
