import { useMemo } from 'react';
import type { AccessGapMeasure } from '../../../store/atlasApi.js';
import { formatByUnit } from '../../../format/values.ts';
import { dumbbellGeometry } from './gapGeometry.ts';
import { describeGap } from './gapPhrasing.ts';
import {
  Baseline,
  Connector,
  Dot,
  Plot,
  Row,
  RowGap,
  RowHead,
  RowLabel,
  RowNote,
  Value,
  Values,
  ValueSwatch,
} from './gapStyles.ts';

interface GapMeasureRowProps {
  measure: AccessGapMeasure;
  showNote: boolean;
}

function GapDumbbell({ measure }: { measure: AccessGapMeasure }): JSX.Element {
  const geometry = useMemo(
    () => dumbbellGeometry(measure.lowest, measure.highest),
    [measure.lowest, measure.highest],
  );

  return (
    <Plot>
      <Baseline />
      {geometry !== null && (
        <>
          <Connector
            style={{
              left: `${geometry.connectorLeft}%`,
              width: `${geometry.connectorWidth}%`,
            }}
          />
          <Dot $end="least" style={{ left: `${geometry.leastPercent}%` }} />
          <Dot $end="most" style={{ left: `${geometry.mostPercent}%` }} />
        </>
      )}
    </Plot>
  );
}

export function GapMeasureRow({ measure, showNote }: GapMeasureRowProps): JSX.Element {
  const gap = describeGap(measure);

  return (
    <Row title={measure.note}>
      <RowHead>
        <RowLabel>{measure.label}</RowLabel>
        {gap === null ? <RowGap $muted>no comparison</RowGap> : <RowGap>{gap}</RowGap>}
      </RowHead>

      <GapDumbbell measure={measure} />

      <Values>
        <Value>
          <ValueSwatch $end="least" />
          {formatByUnit(measure.lowest, measure.unit)}
        </Value>
        <Value>
          <ValueSwatch $end="most" />
          {formatByUnit(measure.highest, measure.unit)}
        </Value>
      </Values>

      {showNote && <RowNote>{measure.note}</RowNote>}
    </Row>
  );
}
