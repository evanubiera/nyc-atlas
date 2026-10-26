import { useState } from 'react';
import { useAccessGapsQuery, type MetricsInput } from '../../../store/atlasApi.js';
import { GapLegend } from './GapLegend.tsx';
import { GapMeasureRow } from './GapMeasureRow.tsx';
import { Caption, Caveat, Lede, NoteToggle, Rows, Wrap } from './gapStyles.ts';

/**
 * What else differs between the fifth of neighborhoods with the most cultural
 * institutions per resident and the fifth with the fewest.
 *
 * One dumbbell per measure, each on its own scale — income is in dollars,
 * supermarkets are per 10,000 residents, proficiency is a share. Putting them
 * on a shared axis would invent comparisons that are not in the data, so each
 * row is its own small chart and carries both values as direct labels.
 */
export function AccessGapsPanel({ input }: { input: MetricsInput }): JSX.Element | null {
  const { data } = useAccessGapsQuery(input);
  const [showNotes, setShowNotes] = useState(false);

  if (!data) return null;

  if (data.measures.length === 0) {
    return (
      <Wrap>
        <Caption>The gap</Caption>
        {data.caveats.map((caveat) => (
          <Caveat key={caveat}>{caveat}</Caveat>
        ))}
      </Wrap>
    );
  }

  return (
    <Wrap>
      <Caption>The gap</Caption>
      <Lede>
        Neighborhoods ranked by {data.exposureLabel}, then the least-served fifth set against
        the best-served fifth.
      </Lede>

      <GapLegend least={data.least} most={data.most} />

      <Rows>
        {data.measures.map((measure) => (
          <GapMeasureRow key={measure.key} measure={measure} showNote={showNotes} />
        ))}
      </Rows>

      <NoteToggle
        type="button"
        onClick={() => setShowNotes((shown) => !shown)}
        aria-expanded={showNotes}
      >
        {showNotes ? 'Hide' : 'Show'} what each number is measuring
      </NoteToggle>

      {data.caveats.map((caveat) => (
        <Caveat key={caveat}>{caveat}</Caveat>
      ))}
    </Wrap>
  );
}
