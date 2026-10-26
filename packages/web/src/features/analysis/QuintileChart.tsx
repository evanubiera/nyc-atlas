import styled from 'styled-components';
import { useQuintilesQuery, type MetricsInput } from '../../store/atlasApi.js';

const LABELS = ['Q1 — fewest institutions', 'Q2', 'Q3', 'Q4', 'Q5 — most institutions'];

interface QuintileBarProps {
  label: string;
  rate: number;
  interval: (number | undefined)[];
  max: number;
  neighborhoodCount: number;
  totalCount: number;
  rateMode: boolean;
}

function QuintileBar({
  label,
  rate,
  interval,
  max,
  neighborhoodCount,
  totalCount,
  rateMode,
}: QuintileBarProps): JSX.Element {
  const barPercent = (rate / max) * 100;
  const lowPercent = ((interval[0] ?? 0) / max) * 100;
  const highPercent = ((interval[1] ?? 0) / max) * 100;

  return (
    <Row>
      <RowLabel>{label}</RowLabel>
      <Track>
        <Bar style={{ width: `${barPercent}%` }} />
        <Whisker
          style={{
            left: `${lowPercent}%`,
            width: `${Math.max(highPercent - lowPercent, 0.4)}%`,
          }}
        />
      </Track>
      <Value>
        {rate.toFixed(rateMode ? 1 : 0)}
        <small>
          {neighborhoodCount} NTAs · {totalCount.toLocaleString()} events
        </small>
      </Value>
    </Row>
  );
}

function DensityModeWarning(): JSX.Element {
  return (
    <Warn>
      Showing <strong>area density</strong>, not per-resident rates — no Census key
      configured. Institutions and incidents both concentrate in dense neighborhoods, so
      this view is confounded by density and may run backwards. Add{' '}
      <code>CENSUS_API_KEY</code> and re-run ingest for per-capita rates and confounder
      adjustment.
    </Warn>
  );
}

/**
 * The headline view: neighborhoods binned by cultural-institution exposure,
 * lowest to highest, with the pooled outcome rate and a 95% Poisson interval.
 *
 * Horizontal bars with CI whiskers — magnitude across ordered groups. Every bar
 * is directly labelled rather than read off an axis, because there are only
 * five and the number is the point.
 */
export function QuintileChart({ input }: { input: MetricsInput }): JSX.Element {
  const { data, isFetching, error } = useQuintilesQuery(input);

  if (error) return <Note role="alert">Could not load the quintile analysis.</Note>;
  if (!data) return <Note>{isFetching ? 'Computing…' : 'No data yet — run npm run ingest.'}</Note>;

  const rateMode = data.outcomeMode === 'RATE_PER_100K';
  const unit = rateMode ? 'per 100,000 residents' : 'per 100 km²';
  const max = Math.max(
    ...data.buckets.map((b) => b.confidenceInterval[1] ?? b.meanOutcomeRate),
    1,
  );

  return (
    <Wrap>
      <Caption>
        Outcome rate by cultural-institution exposure
        <small>{unit} · 95% CI</small>
      </Caption>

      <Rows>
        {data.buckets.map((bucket, index) => (
          <QuintileBar
            key={bucket.quintile}
            label={LABELS[index] ?? `Q${bucket.quintile}`}
            rate={bucket.meanOutcomeRate}
            interval={bucket.confidenceInterval}
            max={max}
            neighborhoodCount={bucket.neighborhoodCount}
            totalCount={bucket.totalCount}
            rateMode={rateMode}
          />
        ))}
      </Rows>

      {!rateMode && <DensityModeWarning />}

      {data.caveats.map((caveat) => (
        <Caveat key={caveat}>{caveat}</Caveat>
      ))}
    </Wrap>
  );
}

const Wrap = styled.div`
  padding: ${({ theme }) => theme.space(3)};
`;

const Caption = styled.h3`
  margin: 0 0 ${({ theme }) => theme.space(3)};
  font-size: 13px;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  gap: 2px;

  small {
    font-weight: 400;
    color: ${({ theme }) => theme.textMuted};
    font-size: 11px;
  }
`;

const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space(2)};
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 148px 1fr 92px;
  align-items: center;
  gap: ${({ theme }) => theme.space(2)};
`;

const RowLabel = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.textSecondary};
`;

const Track = styled.div`
  position: relative;
  height: 18px;
  background: ${({ theme }) => theme.gridline};
  border-radius: 2px;
`;

const Bar = styled.div`
  position: absolute;
  inset-block: 0;
  left: 0;
  background: ${({ theme }) => theme.series[0]};
  border-radius: 0 4px 4px 0;
`;

const Whisker = styled.div`
  position: absolute;
  top: 50%;
  height: 1px;
  background: ${({ theme }) => theme.textPrimary};
  opacity: 0.55;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: -4px;
    width: 1px;
    height: 9px;
    background: ${({ theme }) => theme.textPrimary};
    opacity: 0.8;
  }
  &::before {
    left: 0;
  }
  &::after {
    right: 0;
  }
`;

const Value = styled.div`
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  text-align: right;
  display: flex;
  flex-direction: column;

  small {
    font-size: 10px;
    color: ${({ theme }) => theme.textMuted};
    font-variant-numeric: normal;
  }
`;

const Note = styled.p`
  padding: ${({ theme }) => theme.space(3)};
  margin: 0;
  font-size: 13px;
  color: ${({ theme }) => theme.textMuted};
`;

const Warn = styled.p`
  margin: ${({ theme }) => theme.space(3)} 0 0;
  padding: ${({ theme }) => theme.space(2)};
  font-size: 12px;
  line-height: 1.5;
  background: ${({ theme }) => theme.pagePlane};
  border: 1px solid ${({ theme }) => theme.gridline};
  border-radius: ${({ theme }) => theme.radius.sm};
  color: ${({ theme }) => theme.textSecondary};

  code {
    font-size: 11px;
  }
`;

const Caveat = styled.p`
  margin: ${({ theme }) => theme.space(2)} 0 0;
  padding-left: ${({ theme }) => theme.space(2)};
  border-left: 2px solid ${({ theme }) => theme.series[1]};
  font-size: 11.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.textMuted};
`;
