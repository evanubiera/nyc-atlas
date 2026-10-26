import { useState } from 'react';
import styled from 'styled-components';
import { useDataQualityReportQuery } from '../../store/atlasApi.js';
import { formatCount, pluralize } from '../../format/values.ts';
import { retentionRate, summarizeRejections } from './qualityReport.ts';

/**
 * What the last ingest dropped, and why (specs/008 §7.3).
 *
 * Every stage discards rows — duplicates, missing coordinates, dates that
 * cannot be true — and a count nobody can see is silent data loss. The summary
 * line stays visible; the breakdown expands, because the detail matters to a
 * reader checking the analysis and not to one reading the map.
 */
export function DataQualityPanel(): JSX.Element | null {
  const { data } = useDataQualityReportQuery();
  const [open, setOpen] = useState(false);

  if (!data) return null;

  const summary = summarizeRejections(data.rejections);
  const kept = retentionRate(data.totalRowsProcessed, summary.totalDropped);

  return (
    <Wrap>
      <Caption>Data quality</Caption>

      <Summary>
        {formatCount(data.totalRowsProcessed)} rows processed ·{' '}
        {formatCount(summary.totalDropped)} dropped
        {kept !== null && ` · ${kept} kept`}
      </Summary>

      <Toggle type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? 'Hide what was dropped' : 'Show what was dropped'}
      </Toggle>

      {open && (
        <Detail>
          {summary.byDataset.map((entry) => (
            <section key={entry.dataset}>
              <DatasetName>
                {entry.dataset} — {formatCount(entry.total)}
              </DatasetName>
              <ul>
                {entry.reasons.map((reason) => (
                  <li key={reason.reason}>
                    {reason.reason} <Num>{formatCount(reason.count)}</Num>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {data.recoveredViaFallback > 0 && (
            <Note>
              {pluralize(data.recoveredViaFallback, 'row')} were classified from the
              finer-grained <code>pd_desc</code> field after <code>ofns_desc</code> arrived
              empty, rather than being discarded.
            </Note>
          )}

          {data.unmappedOffenses.length > 0 && (
            <Note>
              Unmapped offense labels: {data.unmappedOffenses.join(', ')}
            </Note>
          )}

          {data.notes.map((note) => (
            <Note key={note}>{note}</Note>
          ))}

          <Generated>Ingest run {new Date(data.generatedAt).toLocaleString()}</Generated>
        </Detail>
      )}
    </Wrap>
  );
}

const Wrap = styled.div`
  padding: ${({ theme }) => theme.space(3)};
  border-top: 1px solid ${({ theme }) => theme.gridline};
`;

const Caption = styled.h3`
  margin: 0 0 ${({ theme }) => theme.space(1)};
  font-size: 13px;
  font-weight: 600;
`;

const Summary = styled.p`
  margin: 0;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.textSecondary};
`;

const Toggle = styled.button`
  margin-top: ${({ theme }) => theme.space(2)};
  padding: 0;
  background: none;
  border: none;
  font: inherit;
  font-size: 11px;
  color: ${({ theme }) => theme.textMuted};
  text-decoration: underline;
  cursor: pointer;
`;

const Detail = styled.div`
  margin-top: ${({ theme }) => theme.space(2)};
  font-size: 11px;
  line-height: 1.5;
  color: ${({ theme }) => theme.textSecondary};

  section + section {
    margin-top: ${({ theme }) => theme.space(2)};
  }

  ul {
    margin: 2px 0 0;
    padding-left: ${({ theme }) => theme.space(4)};
  }

  code {
    font-size: 10px;
  }
`;

const DatasetName = styled.div`
  font-weight: 600;
  color: ${({ theme }) => theme.textPrimary};
`;

const Num = styled.span`
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.textMuted};
`;

const Note = styled.p`
  margin: ${({ theme }) => theme.space(2)} 0 0;
`;

const Generated = styled.p`
  margin: ${({ theme }) => theme.space(3)} 0 0;
  color: ${({ theme }) => theme.textMuted};
`;
