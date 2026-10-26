import styled from 'styled-components';

export const MapCanvas = styled.div`
  position: absolute;
  inset: 0;
`;

export const Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 14px;
`;

export const OverlayMessage = styled.span`
  background: rgba(0, 0, 0, 0.65);
  color: #ffffff;
  padding: 8px 14px;
  border-radius: ${({ theme }) => theme.radius.md};
`;

/**
 * Positioned from the cursor by the only two values that genuinely vary per
 * render; everything else is a token.
 */
export const TooltipCard = styled.div<{ $x: number; $y: number }>`
  position: absolute;
  left: ${({ $x }) => $x + 14}px;
  top: ${({ $y }) => $y + 14}px;
  pointer-events: none;
  background: ${({ theme }) => theme.surface};
  color: ${({ theme }) => theme.textPrimary};
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 9px 11px;
  font-size: 12.5px;
  line-height: 1.45;
  max-width: 290px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
`;

export const TooltipName = styled.strong`
  font-weight: 600;
`;

export const TooltipBorough = styled.div`
  color: ${({ theme }) => theme.textSecondary};
`;

export const TooltipExclusion = styled.div`
  color: ${({ theme }) => theme.textMuted};
  margin-top: 6px;
`;

export const TooltipLines = styled.div`
  margin-top: 6px;
`;

export const TooltipRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 14px;
`;

export const TooltipLabel = styled.span<{ $muted: boolean }>`
  color: ${({ theme, $muted }) => ($muted ? theme.textMuted : theme.textSecondary)};
`;

export const TooltipValue = styled.span<{ $muted: boolean }>`
  font-variant-numeric: tabular-nums;
  color: ${({ theme, $muted }) => ($muted ? theme.textMuted : theme.textPrimary)};
`;
