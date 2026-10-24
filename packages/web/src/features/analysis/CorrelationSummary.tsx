import styled from 'styled-components';
import { useCorrelationQuery, type MetricsInput } from '../../store/atlasApi.js';

/**
 * Raw versus confounder-adjusted association.
 *
 * Two numbers side by side, because the gap between them is the finding: a
 * large raw correlation that collapses after adjustment means the pattern was
 * income, not cultural infrastructure.
 */
export function CorrelationSummary({ input }: { input: MetricsInput }): JSX.Element | null {
  const { data } = useCorrelationQuery(input);
  if (!data) return null;

  return (
    <Wrap>
      <Caption>Association between cultural access and the outcome</Caption>
      <Tiles>
        <Tile>
          <Label>Unadjusted</Label>
          <Figure>{data.raw.toFixed(2)}</Figure>
          <Sub>Pearson r · n = {data.n}</Sub>
        </Tile>
        <Tile>
          <Label>Adjusted</Label>
          <Figure>{data.adjusted === null ? '—' : data.adjusted.toFixed(2)}</Figure>
          <Sub>
            {data.adjusted === null
              ? 'needs Census data'
              : `partial r · controls for ${data.confounders.length}`}
          </Sub>
        </Tile>
      </Tiles>
      <Interpretation>{data.interpretation}</Interpretation>
    </Wrap>
  );
}

const Wrap = styled.div`
  padding: 0 ${({ theme }) => theme.space(3)} ${({ theme }) => theme.space(3)};
  border-top: 1px solid ${({ theme }) => theme.gridline};
  padding-top: ${({ theme }) => theme.space(3)};
`;

const Caption = styled.h3`
  margin: 0 0 ${({ theme }) => theme.space(2)};
  font-size: 13px;
  font-weight: 600;
`;

const Tiles = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.space(2)};
`;

const Tile = styled.div`
  border: 1px solid ${({ theme }) => theme.gridline};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: ${({ theme }) => theme.space(2)};
`;

const Label = styled.div`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.textMuted};
`;

const Figure = styled.div`
  font-size: 26px;
  line-height: 1.2;
  margin-top: 2px;
`;

const Sub = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.textMuted};
`;

const Interpretation = styled.p`
  margin: ${({ theme }) => theme.space(3)} 0 0;
  font-size: 12px;
  line-height: 1.55;
  color: ${({ theme }) => theme.textSecondary};
`;
