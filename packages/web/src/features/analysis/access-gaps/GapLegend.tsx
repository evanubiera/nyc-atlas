import type { AccessGapGroup } from '../../../store/atlasApi.js';
import { formatCompactPeople, pluralize } from '../../../format/values.ts';
import {
  Legend,
  LegendItem,
  LegendSub,
  LegendText,
  Swatch,
  type GapEnd,
} from './gapStyles.ts';

interface GapLegendProps {
  least: AccessGapGroup;
  most: AccessGapGroup;
}

function GapLegendEntry({
  end,
  label,
  group,
}: {
  end: GapEnd;
  label: string;
  group: AccessGapGroup;
}): JSX.Element {
  return (
    <LegendItem>
      <Swatch $end={end} />
      <LegendText>
        {label}
        <LegendSub>
          {pluralize(group.neighborhoodCount, 'neighborhood')} ·{' '}
          {formatCompactPeople(group.population)}
        </LegendSub>
      </LegendText>
    </LegendItem>
  );
}

export function GapLegend({ least, most }: GapLegendProps): JSX.Element {
  return (
    <Legend>
      <GapLegendEntry end="least" label="Least cultural access" group={least} />
      <GapLegendEntry end="most" label="Most cultural access" group={most} />
    </Legend>
  );
}
