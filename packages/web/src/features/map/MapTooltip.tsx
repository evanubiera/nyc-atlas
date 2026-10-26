import type { NeighborhoodMetric } from '../../store/atlasApi.js';
import { formatFullCurrency } from '../../format/values.ts';
import type { NtaProps } from './mapEncoding.ts';
import {
  TooltipBorough,
  TooltipCard,
  TooltipExclusion,
  TooltipLabel,
  TooltipLines,
  TooltipName,
  TooltipRow,
  TooltipValue,
} from './mapStyles.ts';

export interface HoverInfo {
  x: number;
  y: number;
  metric: NeighborhoodMetric | null;
  props: NtaProps;
}

function Line({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}): JSX.Element {
  return (
    <TooltipRow>
      <TooltipLabel $muted={muted}>{label}</TooltipLabel>
      <TooltipValue $muted={muted}>{value}</TooltipValue>
    </TooltipRow>
  );
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
}

/**
 * The raw rate sits beside the smoothed one: the tooltip is where honesty
 * about the shrinkage lives.
 */
function MetricLines({
  metric,
  unit,
}: {
  metric: NeighborhoodMetric;
  unit: string;
}): JSX.Element {
  const interval = metric.confidenceInterval;

  return (
    <TooltipLines>
      <Line label="Incidents" value={metric.rawCount.toLocaleString()} />
      {metric.population !== null && (
        <Line label="Population" value={metric.population.toLocaleString()} />
      )}
      {metric.smoothedRatePer100k !== null && (
        <Line label={`Smoothed ${unit}`} value={metric.smoothedRatePer100k.toFixed(1)} />
      )}
      {metric.ratePer100k !== null && (
        <Line label={`Raw ${unit}`} value={metric.ratePer100k.toFixed(1)} muted />
      )}
      {interval && (
        <Line
          label="95% CI"
          value={`${interval[0]?.toFixed(1)} – ${interval[1]?.toFixed(1)}`}
          muted
        />
      )}
      <Line label="Institutions" value={String(metric.institutionCount)} />
      {metric.residual !== null && <Line label="vs. predicted" value={signed(metric.residual)} />}
      {metric.medianHouseholdIncome !== null && (
        <Line
          label="Median income"
          value={formatFullCurrency(metric.medianHouseholdIncome)}
          muted
        />
      )}
    </TooltipLines>
  );
}

export function MapTooltip({
  hover,
  rateMode,
}: {
  hover: HoverInfo;
  rateMode: boolean;
}): JSX.Element {
  const metric = hover.metric;
  const isExcluded = metric === null || metric.excluded !== null;

  return (
    <TooltipCard $x={hover.x} $y={hover.y}>
      <TooltipName>{hover.props.ntaname}</TooltipName>
      <TooltipBorough>{hover.props.boroname}</TooltipBorough>

      {isExcluded ? (
        <TooltipExclusion>
          {metric?.excluded?.explanation ??
            'Not a residential neighborhood — excluded from rates.'}
        </TooltipExclusion>
      ) : (
        <MetricLines metric={metric} unit={rateMode ? 'per 100k' : 'per km²'} />
      )}
    </TooltipCard>
  );
}
