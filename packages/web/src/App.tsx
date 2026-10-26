import { useMemo, useState } from 'react';
import { ThemeProvider } from 'styled-components';
import { GlobalStyle } from './theme/GlobalStyle.js';
import { resolveTheme } from './theme/index.js';
import { AtlasMap } from './features/map/AtlasMap.js';
import { LimitationsPanel } from './features/transparency/LimitationsPanel.js';
import { FloatingCategoryCaveat } from './features/transparency/CategoryCaveat.tsx';
import { DataQualityPanel } from './features/transparency/DataQualityPanel.tsx';
import { QuintileChart } from './features/analysis/QuintileChart.js';
import { CorrelationSummary } from './features/analysis/CorrelationSummary.js';
import { AccessGapsPanel } from './features/analysis/access-gaps/AccessGapsPanel.tsx';
import { NeighborhoodTable } from './features/analysis/neighborhood-table/NeighborhoodTable.tsx';
import { AtlasControls } from './app/AtlasControls.tsx';
import { AtlasStatus } from './app/AtlasStatus.tsx';
import { useAppSelector } from './store/hooks.js';
import { useFilterUrlSync } from './features/filters/useFilterUrlSync.js';
import type { MetricsInput } from './store/atlasApi.js';
import {
  Body,
  Main,
  MapArea,
  ModeButton,
  Shell,
  Side,
  Title,
  Toolbar,
} from './app/appLayout.ts';

type ThemeMode = 'light' | 'dark';

function preferredMode(): ThemeMode {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function App(): JSX.Element {
  const [mode, setMode] = useState<ThemeMode>(preferredMode);
  const filters = useAppSelector((state) => state.filters);

  useFilterUrlSync();

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
    <ThemeProvider theme={resolveTheme(mode)}>
      <GlobalStyle />
      <Shell>
        <Toolbar>
          <Title>
            <h1>NYC Income and Cultural Institution gaps</h1>
            <AtlasStatus input={input} />
          </Title>
          <AtlasControls input={input} />
          <ModeButton onClick={() => setMode((m) => (m === 'dark' ? 'light' : 'dark'))}>
            {mode === 'dark' ? 'Light' : 'Dark'}
          </ModeButton>
        </Toolbar>

        <Body>
          <Main>
            <MapArea>
              <AtlasMap input={input} />
              <FloatingCategoryCaveat category={filters.category} />
              <LimitationsPanel />
            </MapArea>

            <NeighborhoodTable input={input} />
          </Main>

          <Side>
            <AccessGapsPanel input={input} />
            <QuintileChart input={input} />
            <CorrelationSummary input={input} />
            <DataQualityPanel />
          </Side>
        </Body>
      </Shell>
    </ThemeProvider>
  );
}
