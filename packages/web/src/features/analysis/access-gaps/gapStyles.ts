import styled from 'styled-components';

export type GapEnd = 'least' | 'most';

const endColor = (theme: { gap: { least: string; most: string } }, end: GapEnd): string =>
  end === 'least' ? theme.gap.least : theme.gap.most;

export const Wrap = styled.section`
  padding: ${({ theme }) => theme.space(3)};
  border-bottom: 1px solid ${({ theme }) => theme.gridline};
`;

export const Caption = styled.h3`
  margin: 0 0 2px;
  font-size: 13px;
  font-weight: 600;
`;

export const Lede = styled.p`
  margin: 0 0 ${({ theme }) => theme.space(2)};
  font-size: 11.5px;
  line-height: 1.45;
  color: ${({ theme }) => theme.textMuted};
`;

export const Legend = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space(3)};
  margin-bottom: ${({ theme }) => theme.space(3)};
`;

export const LegendItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
`;

export const Swatch = styled.span<{ $end: GapEnd }>`
  width: 9px;
  height: 9px;
  margin-top: 3px;
  flex: none;
  border-radius: 50%;
  background: ${({ theme, $end }) => endColor(theme, $end)};
`;

export const LegendText = styled.div`
  font-size: 11px;
  line-height: 1.3;
  color: ${({ theme }) => theme.textSecondary};
  min-width: 0;
`;

export const LegendSub = styled.div`
  color: ${({ theme }) => theme.textMuted};
  font-variant-numeric: tabular-nums;
`;

export const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space(2)};
`;

export const Row = styled.div`
  display: grid;
  gap: 3px;
`;

export const RowHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space(2)};
`;

export const RowLabel = styled.div`
  font-size: 11.5px;
  color: ${({ theme }) => theme.textPrimary};
`;

export const RowGap = styled.div<{ $muted?: boolean }>`
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: ${({ theme, $muted }) => ($muted === true ? theme.textMuted : theme.textSecondary)};
`;

export const Plot = styled.div`
  position: relative;
  height: 11px;
  /* The dots sit on a 0-100% track; inset so neither end is clipped. */
  margin: 0 5px;
`;

export const Baseline = styled.div`
  position: absolute;
  top: 5px;
  left: 0;
  right: 0;
  height: 1px;
  background: ${({ theme }) => theme.gridline};
`;

export const Connector = styled.div`
  position: absolute;
  top: 4.5px;
  height: 2px;
  background: ${({ theme }) => theme.baseline};
`;

export const Dot = styled.span<{ $end: GapEnd }>`
  position: absolute;
  top: 0;
  width: 11px;
  height: 11px;
  margin-left: -5.5px;
  border-radius: 50%;
  background: ${({ theme, $end }) => endColor(theme, $end)};
  /* A 2px surface ring rather than a border, so overlapping ends stay readable. */
  box-shadow: 0 0 0 2px ${({ theme }) => theme.surface};
`;

export const Values = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space(3)};
`;

export const Value = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.textSecondary};
`;

export const ValueSwatch = styled.span<{ $end: GapEnd }>`
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background: ${({ theme, $end }) => endColor(theme, $end)};
`;

export const RowNote = styled.p`
  margin: 2px 0 0;
  font-size: 10.5px;
  line-height: 1.45;
  color: ${({ theme }) => theme.textMuted};
`;

export const NoteToggle = styled.button`
  margin-top: ${({ theme }) => theme.space(2)};
  padding: 0;
  background: none;
  border: none;
  font: inherit;
  font-size: 11px;
  color: ${({ theme }) => theme.textMuted};
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
`;

export const Caveat = styled.p`
  margin: ${({ theme }) => theme.space(2)} 0 0;
  font-size: 10.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.textMuted};
`;
