import { useMemo } from 'react';
import styled, { useTheme } from 'styled-components';
import { useMetricsQuery, type MetricsInput } from '../../store/atlasApi.js';
import {
  clampLabelAnchor,
  extentOf,
  project,
  selectExtremes,
  toScatterPoints,
} from './scatterGeometry.ts';

const WIDTH = 320;
const HEIGHT = 220;
const PAD = { top: 10, right: 12, bottom: 30, left: 38 };

const PLOT_WIDTH = WIDTH - PAD.left - PAD.right;
const PLOT_HEIGHT = HEIGHT - PAD.top - PAD.bottom;

/**
 * Cultural-institution exposure against the outcome rate, one dot per
 * neighborhood (specs/006, 008 §6.1).
 *
 * The quintile chart answers the same question in bins; this is the
 * unaggregated form, which is what shows the spread the bins hide — whether
 * the pattern is a trend or two clusters with a line drawn through them.
 *
 * Only the extremes are labelled. Naming 197 dots is unreadable and naming
 * none leaves a cloud with nothing to anchor it.
 */
export function ScatterPanel({ input }: { input: MetricsInput }): JSX.Element | null {
  const theme = useTheme();
  const { data } = useMetricsQuery(input);

  const { points, xExtent, yExtent, extremes } = useMemo(() => {
    const plotted = toScatterPoints(data?.rows ?? []);
    return {
      points: plotted,
      xExtent: extentOf(plotted.map((p) => p.x)),
      yExtent: extentOf(plotted.map((p) => p.y)),
      extremes: selectExtremes(plotted),
    };
  }, [data?.rows]);

  if (!data) return null;

  if (points.length === 0) {
    return (
      <Wrap>
        <Caption>Exposure against outcome</Caption>
        <Empty>No neighborhood has both an exposure and a rate for this selection.</Empty>
      </Wrap>
    );
  }

  const labelled = new Set(extremes.map((p) => p.nta2020));
  const px = (value: number): number => PAD.left + project(value, xExtent, PLOT_WIDTH);
  const py = (value: number): number =>
    PAD.top + PLOT_HEIGHT - project(value, yExtent, PLOT_HEIGHT);

  return (
    <Wrap>
      <Caption>Exposure against outcome</Caption>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={
          `Scatter plot of ${points.length} neighborhoods: cultural-institution exposure ` +
          `on the horizontal axis against the smoothed outcome rate on the vertical.`
        }
      >
        <line
          x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + PLOT_HEIGHT}
          stroke={theme.baseline} strokeWidth={1}
        />
        <line
          x1={PAD.left} y1={PAD.top + PLOT_HEIGHT} x2={PAD.left + PLOT_WIDTH} y2={PAD.top + PLOT_HEIGHT}
          stroke={theme.baseline} strokeWidth={1}
        />

        {points.map((point) => (
          <circle
            key={point.nta2020}
            cx={px(point.x)}
            cy={py(point.y)}
            r={labelled.has(point.nta2020) ? 3.4 : 2.2}
            fill={labelled.has(point.nta2020) ? theme.series[0] : theme.series[2]}
            fillOpacity={labelled.has(point.nta2020) ? 0.95 : 0.5}
          >
            <title>
              {point.name} — exposure {point.x.toFixed(2)}, rate {point.y.toFixed(1)}
            </title>
          </circle>
        ))}

        {extremes.map((point) => (
          <text
            key={`label-${point.nta2020}`}
            x={px(point.x)}
            y={py(point.y) - 6}
            textAnchor={clampLabelAnchor(px(point.x) - PAD.left, PLOT_WIDTH)}
            fontSize={9}
            fill={theme.textPrimary}
          >
            {point.name}
          </text>
        ))}

        <text x={PAD.left} y={HEIGHT - 6} fontSize={9} fill={theme.textMuted}>
          cultural institutions per 10k →
        </text>
        <text
          x={-(PAD.top + PLOT_HEIGHT / 2)}
          y={10}
          transform="rotate(-90)"
          textAnchor="middle"
          fontSize={9}
          fill={theme.textMuted}
        >
          rate →
        </text>
      </svg>

      <Note>
        Each dot is one neighborhood. Only the extremes are named; hover any dot for its
        figures. Rates are smoothed, so small neighborhoods sit nearer their borough mean
        than their raw counts would put them.
      </Note>
    </Wrap>
  );
}

const Wrap = styled.div`
  padding: ${({ theme }) => theme.space(3)};
  border-top: 1px solid ${({ theme }) => theme.gridline};

  svg {
    display: block;
    width: 100%;
    height: auto;
  }
`;

const Caption = styled.h3`
  margin: 0 0 ${({ theme }) => theme.space(2)};
  font-size: 13px;
  font-weight: 600;
`;

const Note = styled.p`
  margin: ${({ theme }) => theme.space(2)} 0 0;
  font-size: 11px;
  line-height: 1.5;
  color: ${({ theme }) => theme.textMuted};
`;

const Empty = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.textMuted};
`;
