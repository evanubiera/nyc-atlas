import { useState } from 'react';
import { ThemeProvider } from 'styled-components';
import styled from 'styled-components';
import { GlobalStyle } from './theme/GlobalStyle.js';
import { resolveTheme } from './theme/index.js';
import { AtlasMap } from './features/map/AtlasMap.js';
import { LimitationsPanel } from './features/transparency/LimitationsPanel.js';
import { useAppDispatch, useAppSelector } from './store/hooks.js';
import { setExtrude, setResidentialOnly } from './features/filters/filtersSlice.js';
import { useCapabilitiesQuery } from './store/atlasApi.js';

export function App(): JSX.Element {
  const [mode, setMode] = useState<'light' | 'dark'>(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const theme = resolveTheme(mode);

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Shell>
        {/* Filters sit in one row above the map, never in a drawer — specs/006. */}
        <Toolbar>
          <Title>
            <h1>NYC Cultural Infrastructure &amp; Neighborhood Safety Atlas</h1>
            <Status />
          </Title>
          <Controls>
            <FilterRow />
            <ModeButton onClick={() => setMode((m) => (m === 'dark' ? 'light' : 'dark'))}>
              {mode === 'dark' ? 'Light' : 'Dark'}
            </ModeButton>
          </Controls>
        </Toolbar>

        <MapArea>
          <AtlasMap />
          <LimitationsPanel />
        </MapArea>
      </Shell>
    </ThemeProvider>
  );
}

function Status(): JSX.Element {
  const { data, isLoading } = useCapabilitiesQuery();
  if (isLoading) return <Sub>connecting to BFF…</Sub>;
  if (!data) return <Sub>BFF unavailable</Sub>;
  return (
    <Sub>
      {data.residentialNeighborhoodCount} residential neighborhoods ·{' '}
      {data.neighborhoodCount - data.residentialNeighborhoodCount} excluded
      {!data.censusApiAvailable && ' · demographics degraded'}
    </Sub>
  );
}

function FilterRow(): JSX.Element {
  const dispatch = useAppDispatch();
  const { extrude, residentialOnly } = useAppSelector((s) => s.filters);
  return (
    <>
      <Check>
        <input
          type="checkbox"
          checked={extrude}
          onChange={(e) => dispatch(setExtrude(e.target.checked))}
        />
        3D extrusion
      </Check>
      <Check>
        <input
          type="checkbox"
          checked={residentialOnly}
          onChange={(e) => dispatch(setResidentialOnly(e.target.checked))}
        />
        Residential only
      </Check>
    </>
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
  gap: ${({ theme }) => theme.space(3)};
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.space(3)} ${({ theme }) => theme.space(4)};
  background: ${({ theme }) => theme.surface};
  border-bottom: 1px solid ${({ theme }) => theme.gridline};
  z-index: 10;
`;

const Title = styled.div`
  h1 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
`;

const Sub = styled.p`
  margin: 2px 0 0;
  font-size: 12px;
  color: ${({ theme }) => theme.textMuted};
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space(4)};
  font-size: 13px;
`;

const Check = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space(1)};
  color: ${({ theme }) => theme.textSecondary};
  cursor: pointer;
  user-select: none;
`;

const ModeButton = styled.button`
  background: none;
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  color: ${({ theme }) => theme.textSecondary};
  font: inherit;
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
`;

const MapArea = styled.main`
  position: relative;
  overflow: hidden;
`;
