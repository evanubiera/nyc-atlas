import { useMemo, useState } from 'react';
import styled, { ThemeProvider } from 'styled-components';
import { CRIME_CATEGORIES, CRIME_CATEGORY_META, type CrimeCategory } from '@nyc-atlas/shared';
import { GlobalStyle } from './theme/GlobalStyle.js';
import { resolveTheme } from './theme/index.js';
import { AtlasMap } from './features/map/AtlasMap.js';
import { LimitationsPanel } from './features/transparency/LimitationsPanel.js';
import { QuintileChart } from './features/analysis/QuintileChart.js';
import { CorrelationSummary } from './features/analysis/CorrelationSummary.js';
import { useAppDispatch, useAppSelector } from './store/hooks.js';
import {
  setCategory,
  setExposure,
  setInstitutionScope,
  setMapMode,
  setShowInstitutions,
  setExtrude,
  type MapMode,
} from './features/filters/filtersSlice.js';
import { useMetricsQuery, type MetricsInput } from './store/atlasApi.js';

const MAP_MODES: { value: MapMode; label: string; hint: string }[] = [
  { value: 'OUTCOME', label: 'Crime rate', hint: 'Sequential: magnitude of the outcome.' },
  {
    value: 'RESIDUAL',
    label: 'vs. predicted',
    hint: 'Diverging: observed minus what income, poverty, density, age and tenure predict. Red means more incidents than socioeconomics alone explain.',
  },
  {
    value: 'BIVARIATE',
    label: 'Access × crime',
    hint: 'Both axes at once. The deepest red is low cultural access with high crime.',
  },
];

export function App(): JSX.Element {
  const [mode, setMode] = useState<'light' | 'dark'>(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const theme = resolveTheme(mode);
  const filters = useAppSelector((s) => s.filters);

  const input: MetricsInput = useMemo(
    () => ({
      category: filters.category,
      exposure: filters.exposure,
      scope: filters.institutionScope,
      from: filters.from,
      to: filters.to,
    }),
    [filters.category, filters.exposure, filters.institutionScope, filters.from, filters.to],
  );

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Shell>
        <Toolbar>
          <Title>
            <h1>NYC Cultural Infrastructure &amp; Neighborhood Safety Atlas</h1>
            <Status input={input} />
          </Title>
          <Controls input={input} />
          <ModeButton onClick={() => setMode((m) => (m === 'dark' ? 'light' : 'dark'))}>
            {mode === 'dark' ? 'Light' : 'Dark'}
          </ModeButton>
        </Toolbar>

        <Body>
          <MapArea>
            <AtlasMap input={input} />
            <LimitationsPanel />
          </MapArea>

          <Side>
            <QuintileChart input={input} />
            <CorrelationSummary input={input} />
          </Side>
        </Body>
      </Shell>
    </ThemeProvider>
  );
}

function Status({ input }: { input: MetricsInput }): JSX.Element {
  const { data } = useMetricsQuery(input);
  if (!data) return <Sub>connecting…</Sub>;
  const counted = data.rows.filter((r) => r.excluded === null).length;
  const events = data.rows.reduce((a, r) => a + r.rawCount, 0);
  return (
    <Sub>
      {counted} neighborhoods · {events.toLocaleString()} events ·{' '}
      {data.outcomeMode === 'RATE_PER_100K' ? 'per-capita rates' : 'area density (no Census key)'}
    </Sub>
  );
}

function Controls({ input }: { input: MetricsInput }): JSX.Element {
  const dispatch = useAppDispatch();
  const f = useAppSelector((s) => s.filters);
  const { data } = useMetricsQuery(input);
  const rateMode = data?.outcomeMode === 'RATE_PER_100K';

  return (
    <ControlRow>
      <Field>
        <FieldLabel htmlFor="category">Outcome</FieldLabel>
        <Select
          id="category"
          value={f.category}
          onChange={(e) => dispatch(setCategory(e.target.value as CrimeCategory))}
        >
          {CRIME_CATEGORIES.filter((c) => c !== 'UNKNOWN').map((c) => (
            <option key={c} value={c}>
              {CRIME_CATEGORY_META[c].label}
              {CRIME_CATEGORY_META[c].isEnforcementDriven ? ' (enforcement-driven)' : ''}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="exposure">Cultural access</FieldLabel>
        <Select
          id="exposure"
          value={f.exposure}
          onChange={(e) => dispatch(setExposure(e.target.value as never))}
          disabled={!rateMode}
          title={rateMode ? undefined : 'Per-capita measures need a Census key'}
        >
          <option value="PER_CAPITA">per 10k residents</option>
          <option value="DENSITY">per km²</option>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="scope">Institutions</FieldLabel>
        <Select
          id="scope"
          value={f.institutionScope}
          onChange={(e) => dispatch(setInstitutionScope(e.target.value as never))}
        >
          <option value="NARROW">DCLA arts orgs</option>
          <option value="STANDARD">+ libraries &amp; museums</option>
          <option value="BROAD">+ parks &amp; historic sites</option>
        </Select>
      </Field>

      <Field>
        <FieldLabel>Map shows</FieldLabel>
        <Segmented role="group" aria-label="Map encoding">
          {MAP_MODES.map((m) => (
            <SegButton
              key={m.value}
              type="button"
              title={m.hint}
              $active={f.mapMode === m.value}
              onClick={() => dispatch(setMapMode(m.value))}
            >
              {m.label}
            </SegButton>
          ))}
        </Segmented>
      </Field>

      <Checks>
        <Check>
          <input
            type="checkbox"
            checked={f.showInstitutions}
            onChange={(e) => dispatch(setShowInstitutions(e.target.checked))}
          />
          Institutions
        </Check>
        <Check>
          <input
            type="checkbox"
            checked={f.extrude}
            onChange={(e) => dispatch(setExtrude(e.target.checked))}
          />
          3D
        </Check>
      </Checks>
    </ControlRow>
  );
}

const Shell = styled.div`
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100%;
`;

const Toolbar = styled.header`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space(4)};
  align-items: flex-end;
  padding: ${({ theme }) => theme.space(2)} ${({ theme }) => theme.space(4)};
  background: ${({ theme }) => theme.surface};
  border-bottom: 1px solid ${({ theme }) => theme.gridline};
  z-index: 10;
`;

const Title = styled.div`
  margin-right: auto;
  h1 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
`;

const Sub = styled.p`
  margin: 2px 0 0;
  font-size: 11.5px;
  color: ${({ theme }) => theme.textMuted};
`;

const ControlRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: ${({ theme }) => theme.space(3)};
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const FieldLabel = styled.label`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.textMuted};
`;

const Select = styled.select`
  font: inherit;
  font-size: 12px;
  padding: 3px 6px;
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.textPrimary};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: ${({ theme }) => theme.radius.sm};

  &:disabled {
    opacity: 0.5;
  }
`;

const Segmented = styled.div`
  display: inline-flex;
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  overflow: hidden;
`;

const SegButton = styled.button<{ $active: boolean }>`
  font: inherit;
  font-size: 12px;
  padding: 3px 9px;
  border: none;
  cursor: pointer;
  background: ${({ theme, $active }) => ($active ? theme.series[0] : 'transparent')};
  color: ${({ theme, $active }) => ($active ? '#ffffff' : theme.textSecondary)};

  & + & {
    border-left: 1px solid ${({ theme }) => theme.border};
  }
`;

const Checks = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space(3)};
  padding-bottom: 3px;
`;

const Check = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: ${({ theme }) => theme.textSecondary};
  cursor: pointer;
  user-select: none;
`;

const ModeButton = styled.button`
  align-self: flex-end;
  margin-bottom: 3px;
  background: none;
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  color: ${({ theme }) => theme.textSecondary};
  font: inherit;
  font-size: 12px;
  padding: 3px 10px;
  cursor: pointer;
`;

const Body = styled.main`
  display: grid;
  grid-template-columns: 1fr 390px;
  overflow: hidden;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }
`;

const MapArea = styled.div`
  position: relative;
  overflow: hidden;
`;

const Side = styled.aside`
  border-left: 1px solid ${({ theme }) => theme.gridline};
  background: ${({ theme }) => theme.surface};
  overflow-y: auto;
`;
