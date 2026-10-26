import styled from 'styled-components';

export const Wrap = styled.section`
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  background: ${({ theme }) => theme.surface};
`;

export const Head = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space(3)};
  padding: ${({ theme }) => theme.space(2)} ${({ theme }) => theme.space(3)};
  border-bottom: 1px solid ${({ theme }) => theme.gridline};
`;

export const Caption = styled.h3`
  margin: 0;
  font-size: 13px;
  font-weight: 600;
`;

export const Count = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.textMuted};
`;

export const Scroller = styled.div`
  overflow: auto;
  min-height: 0;
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  table-layout: fixed;
`;

export const Th = styled.th<{ $numeric: boolean }>`
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0;
  text-align: ${({ $numeric }) => ($numeric ? 'right' : 'left')};
  vertical-align: bottom;
  background: ${({ theme }) => theme.surface};
  border-bottom: 1px solid ${({ theme }) => theme.baseline};
`;

export const SortButton = styled.button<{ $numeric: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: ${({ $numeric }) => ($numeric ? 'flex-end' : 'flex-start')};
  gap: 1px;
  width: 100%;
  padding: ${({ theme }) => theme.space(2)};
  background: none;
  border: none;
  font: inherit;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.textSecondary};
  cursor: pointer;
  text-align: inherit;

  &:hover {
    color: ${({ theme }) => theme.textPrimary};
  }
`;

export const Arrow = styled.span`
  display: inline-block;
  width: 9px;
  font-size: 9px;
`;

export const Unit = styled.span`
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  font-size: 10px;
  color: ${({ theme }) => theme.textMuted};
`;

export const Tr = styled.tr<{ $expanded: boolean }>`
  background: ${({ theme, $expanded }) => ($expanded ? theme.pagePlane : 'transparent')};

  &:hover {
    background: ${({ theme }) => theme.pagePlane};
  }
`;

export const Td = styled.td`
  padding: ${({ theme }) => theme.space(1)} ${({ theme }) => theme.space(2)};
  border-bottom: 1px solid ${({ theme }) => theme.gridline};
  vertical-align: middle;
`;

export const Num = styled(Td)`
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.textSecondary};
`;

const Clipped = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const Name = styled(Clipped)`
  color: ${({ theme }) => theme.textPrimary};
  line-height: 1.3;
`;

export const Meta = styled(Clipped)`
  font-size: 10.5px;
  color: ${({ theme }) => theme.textMuted};
  font-variant-numeric: tabular-nums;
`;

export const Zero = styled.span`
  color: ${({ theme }) => theme.textMuted};
`;

/**
 * The expand affordance. Padded well past the glyph so the hit target clears
 * the 24px minimum on a dense row.
 */
export const Disclosure = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  padding: 2px 4px;
  margin: -2px -4px;
  background: none;
  border: none;
  border-radius: ${({ theme }) => theme.radius.sm};
  font: inherit;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.textPrimary};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.gridline};
  }
`;

/**
 * Drawn with borders rather than set as a glyph: at this size a text triangle
 * renders as an indeterminate smudge and reads as a stray dot next to the count.
 */
export const Chevron = styled.span<{ $open: boolean }>`
  display: inline-block;
  width: 0;
  height: 0;
  flex: none;
  border-left: 5px solid currentColor;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  color: ${({ theme }) => theme.textMuted};
  transform: rotate(${({ $open }) => ($open ? '90deg' : '0deg')});
  transition: transform 120ms ease;

  ${Disclosure}:hover & {
    color: ${({ theme }) => theme.textSecondary};
  }
`;

export const PanelCell = styled.td`
  padding: ${({ theme }) => theme.space(2)} ${({ theme }) => theme.space(3)}
    ${({ theme }) => theme.space(3)};
  background: ${({ theme }) => theme.pagePlane};
  border-bottom: 1px solid ${({ theme }) => theme.gridline};
`;

export const PanelHead = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.textSecondary};
  margin-bottom: ${({ theme }) => theme.space(2)};
`;

export const PanelWarn = styled.span`
  color: ${({ theme }) => theme.textMuted};
`;

export const List = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 2px ${({ theme }) => theme.space(3)};
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 220px;
  overflow-y: auto;
`;

export const Item = styled.li`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space(2)};
  padding: 2px 0;
  font-size: 11.5px;
  min-width: 0;
`;

export const ItemName = styled(Clipped)`
  color: ${({ theme }) => theme.textPrimary};
`;

export const ItemKind = styled(Clipped)`
  flex: none;
  font-size: 10.5px;
  color: ${({ theme }) => theme.textMuted};
  max-width: 45%;
`;

export const Empty = styled.p`
  padding: ${({ theme }) => theme.space(4)} ${({ theme }) => theme.space(3)};
  font-size: 12px;
  color: ${({ theme }) => theme.textMuted};
`;
