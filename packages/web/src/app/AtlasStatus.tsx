import { useMetricsQuery, type MetricsInput } from '../store/atlasApi.js';
import { pluralize } from '../format/values.ts';
import { Sub } from './appLayout.ts';

export function AtlasStatus({ input }: { input: MetricsInput }): JSX.Element {
  const { data } = useMetricsQuery(input);
  if (!data) return <Sub>connecting…</Sub>;

  const counted = data.rows.filter((row) => row.excluded === null).length;
  const institutions = data.rows.reduce((total, row) => total + row.institutionCount, 0);
  const events = data.rows.reduce((total, row) => total + row.rawCount, 0);
  const denominator =
    data.outcomeMode === 'RATE_PER_100K' ? 'per-capita rates' : 'area density (no Census key)';

  return (
    <Sub>
      {pluralize(counted, 'neighborhood')} · {pluralize(institutions, 'institution')} ·{' '}
      {pluralize(events, 'event')} · {denominator}
    </Sub>
  );
}
