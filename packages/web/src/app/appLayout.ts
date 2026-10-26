import styled from 'styled-components';

export const Shell = styled.div`
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
`;

export const Toolbar = styled.header`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space(4)};
  align-items: flex-end;
  padding: ${({ theme }) => theme.space(2)} ${({ theme }) => theme.space(4)};
  background: ${({ theme }) => theme.surface};
  border-bottom: 1px solid ${({ theme }) => theme.gridline};
  z-index: 10;
`;

export const Title = styled.div`
  margin-right: auto;
  /* Without this the status line's intrinsic width forces the whole toolbar
     wider, pushing the theme toggle onto a second row. */
  min-width: 0;

  h1 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
`;

export const Sub = styled.p`
  margin: 2px 0 0;
  font-size: 11.5px;
  color: ${({ theme }) => theme.textMuted};
`;

export const ModeButton = styled.button`
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

/**
 * Three regions on one screen, each scrolling inside itself rather than growing
 * the page: map, the full table, and the analysis column. `minmax(0, …)` on
 * every track is what lets the children scroll instead of stretching the grid.
 */
export const Body = styled.main`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  min-height: 0;
  overflow: hidden;

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
    overflow-y: auto;
  }
`;

export const Main = styled.div`
  display: grid;
  /* The table carries slightly more of the height than the map: with the gap
     panel beside it, the per-neighborhood numbers are the subject. */
  grid-template-rows: minmax(160px, 0.9fr) minmax(0, 1.1fr);
  min-height: 0;
  overflow: hidden;

  @media (max-width: 1100px) {
    grid-template-rows: minmax(260px, 1fr) minmax(240px, 1fr);
  }
`;

export const MapArea = styled.div`
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid ${({ theme }) => theme.gridline};
`;

export const Side = styled.aside`
  border-left: 1px solid ${({ theme }) => theme.gridline};
  background: ${({ theme }) => theme.surface};
  overflow-y: auto;
  min-height: 0;

  @media (max-width: 1100px) {
    border-left: none;
    border-top: 1px solid ${({ theme }) => theme.gridline};
  }
`;
