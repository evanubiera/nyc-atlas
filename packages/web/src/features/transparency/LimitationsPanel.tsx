import { useState } from 'react';
import styled from 'styled-components';
import { useCapabilitiesQuery, useProvenanceQuery } from '../../store/atlasApi.js';

/**
 * Required by specs/001 FR-4.1 and specs/007 §9. The association-not-causation
 * line is always visible; the detail expands. There is deliberately no way to
 * dismiss the summary line.
 */
export function LimitationsPanel(): JSX.Element {
  const [open, setOpen] = useState(false);
  const { data: caps } = useCapabilitiesQuery();
  const { data: prov } = useProvenanceQuery();

  return (
    <Panel>
      <Always>
        <Dot aria-hidden>●</Dot>
        <span>
          This atlas shows <strong>statistical association, not causation</strong>. Cultural
          institutions tend to locate in already-safer, wealthier areas.
        </span>
        <Toggle onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? 'Hide detail' : 'Why this matters'}
        </Toggle>
      </Always>

      {open && (
        <Detail>
          <h4>Known limitations</h4>
          <ul>
            <li>
              <strong>Reverse causality.</strong> Institutions follow safety and property values
              at least as much as they might produce them. Cross-sectional data cannot separate
              the directions.
            </li>
            <li>
              <strong>Reporting bias.</strong> Complaint counts measure <em>reported</em> crime.
              Reporting falls where institutional trust is lowest — often the same neighborhoods
              with the least cultural investment. Shooting data is used as the primary outcome
              because it is far less sensitive to this.
            </li>
            <li>
              <strong>Enforcement-driven categories.</strong> Drug, disorder, traffic and
              administrative counts reflect police deployment as much as behaviour, so they are
              off by default.
            </li>
            <li>
              <strong>Coverage bias in the exposure.</strong> The DCLA directory lists largely
              city-funded organizations and under-counts informal cultural space — church
              basements, social clubs, studios — most severely in low-income neighborhoods.
            </li>
            <li>
              <strong>Residual confounding is certain.</strong> Redlining and historical
              disinvestment are common causes of both low cultural investment and present-day
              violence, and are not measured here.
            </li>
            <li>
              <strong>MAUP.</strong> Results can change with the choice of geography; a
              Community-District view is provided as a sensitivity check.
            </li>
          </ul>

          {caps && caps.degradedFeatures.length > 0 && (
            <>
              <h4>Currently degraded</h4>
              <ul>
                {caps.degradedFeatures.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </>
          )}

          {prov && (
            <>
              <h4>Sources</h4>
              <ul>
                {prov.datasets.map((d) => (
                  <li key={d.id}>
                    <code>{d.id}</code> — {d.name}
                  </li>
                ))}
              </ul>
              <Attribution>{prov.attribution}</Attribution>
            </>
          )}
        </Detail>
      )}
    </Panel>
  );
}

const Panel = styled.aside`
  position: absolute;
  left: ${({ theme }) => theme.space(3)};
  bottom: ${({ theme }) => theme.space(3)};
  z-index: 5;
  max-width: 520px;
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.textPrimary};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.16);
  font-size: 13px;
  line-height: 1.5;
`;

const Always = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.space(2)};
  padding: ${({ theme }) => theme.space(3)};
`;

const Dot = styled.span`
  color: ${({ theme }) => theme.series[1]};
  font-size: 10px;
  line-height: 1.6;
`;

const Toggle = styled.button`
  flex: 0 0 auto;
  margin-left: auto;
  background: none;
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  color: ${({ theme }) => theme.textSecondary};
  font: inherit;
  font-size: 12px;
  padding: 3px 8px;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.textPrimary};
  }
`;

const Detail = styled.div`
  border-top: 1px solid ${({ theme }) => theme.gridline};
  padding: ${({ theme }) => theme.space(3)};
  max-height: 46vh;
  overflow-y: auto;

  h4 {
    margin: ${({ theme }) => theme.space(3)} 0 ${({ theme }) => theme.space(1)};
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: ${({ theme }) => theme.textMuted};
  }
  h4:first-child {
    margin-top: 0;
  }
  ul {
    margin: 0;
    padding-left: 18px;
  }
  li {
    margin-bottom: ${({ theme }) => theme.space(1)};
  }
  code {
    font-size: 12px;
    color: ${({ theme }) => theme.textSecondary};
  }
`;

const Attribution = styled.p`
  margin: ${({ theme }) => theme.space(3)} 0 0;
  color: ${({ theme }) => theme.textMuted};
  font-size: 12px;
`;
