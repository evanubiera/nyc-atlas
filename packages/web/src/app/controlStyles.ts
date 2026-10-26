import styled from 'styled-components';

export const ControlRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: ${({ theme }) => theme.space(3)};
`;

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

export const FieldLabel = styled.label`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.textMuted};
`;

export const Select = styled.select`
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

export const Segmented = styled.div`
  display: inline-flex;
  border: 1px solid ${({ theme }) => theme.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  overflow: hidden;
`;

export const SegButton = styled.button<{ $active: boolean }>`
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

export const Checks = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space(3)};
  padding-bottom: 3px;
`;

export const Check = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: ${({ theme }) => theme.textSecondary};
  cursor: pointer;
  user-select: none;
`;
