import styled from 'styled-components';

// ---------------------------------------------------------------------------
// Styled components for WamEffectsExample (Berlin-underground dark palette via
// Docusaurus `--ifm-*` CSS vars, WAM/native accent colors from the site theme).
// Extracted to a sibling module to keep the example component under the 800-line
// project cap.
// ---------------------------------------------------------------------------

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

export const Banner = styled.div`
  padding: 0.75rem 1rem;
  border: 1px solid var(--ifm-color-warning, #e6a700);
  border-left: 4px solid var(--ifm-color-warning, #e6a700);
  border-radius: 0.25rem;
  background: var(--ifm-color-warning-contrast-background, #fff8e1);
  color: var(--ifm-color-content, #333);
  font-size: 0.9rem;

  [data-theme='dark'] & {
    background: rgba(230, 167, 0, 0.12);
  }
`;

export const StatusLine = styled.div<{ $tone: 'ok' | 'error' }>`
  padding: 0.6rem 0.9rem;
  border-radius: 0.25rem;
  font-size: 0.85rem;
  font-family: 'Courier New', monospace;
  color: white;
  background: ${({ $tone }) =>
    $tone === 'ok' ? 'var(--ifm-color-success, #2e7d32)' : 'var(--ifm-color-danger, #c62828)'};
`;

export const Panel = styled.div`
  background: var(--ifm-background-surface-color, #f8f9fa);
  border: 1px solid var(--ifm-color-emphasis-300, #ddd);
  border-radius: 8px;
  padding: 16px;
`;

export const PanelTitle = styled.h3`
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--ifm-color-content, #333);
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const CountBadge = styled.span`
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--ifm-color-primary, #3578e5);
  color: white;
  font-weight: 500;

  [data-theme='dark'] & {
    color: #0a0a0f;
  }
`;

export const RacksRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

export const Row = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
`;

export const Select = styled.select`
  padding: 6px 10px;
  border: 1px solid var(--ifm-color-emphasis-300, #ddd);
  border-radius: 6px;
  background: var(--ifm-background-color, #fff);
  color: var(--ifm-color-content, #333);
  font-size: 13px;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: var(--ifm-color-primary, #3578e5);
  }
`;

export const PrimaryButton = styled.button`
  padding: 7px 14px;
  background: var(--ifm-color-primary, #3578e5);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--ifm-color-primary-dark, #2d66c3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  [data-theme='dark'] & {
    color: #0a0a0f;
  }
`;

export const GhostButton = styled.button`
  padding: 6px 10px;
  background: transparent;
  color: var(--ifm-color-content, #333);
  border: 1px solid var(--ifm-color-emphasis-300, #ddd);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--ifm-color-emphasis-200, #e8e8e8);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const EmptyState = styled.div`
  text-align: center;
  padding: 20px;
  color: var(--ifm-color-content-secondary, #666);
  font-size: 13px;
  border: 2px dashed var(--ifm-color-emphasis-300, #ddd);
  border-radius: 8px;
`;

export const EntryCard = styled.div`
  border: 1px solid var(--ifm-color-emphasis-200, #e0e0e0);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 8px;
`;

export const EntryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--ifm-color-emphasis-100, #f2f2f2);

  [data-theme='dark'] & {
    background: #252530;
  }
`;

export const EntryName = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: var(--ifm-color-content, #333);
`;

export const Badge = styled.span<{ $kind: 'native' | 'wam' }>`
  font-size: 9px;
  letter-spacing: 0.04em;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  font-weight: 700;
  color: #0a0a0f;
  background: ${({ $kind }) => ($kind === 'wam' ? '#63C75F' : '#c49a6c')};
`;

export const HeaderButtons = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
`;

export const SmallButton = styled.button<{ $variant?: 'danger' | 'muted' | 'active' }>`
  padding: 3px 8px;
  font-size: 11px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: white;
  background: ${({ $variant }) =>
    $variant === 'danger'
      ? 'var(--ifm-color-danger, #dc3545)'
      : $variant === 'muted'
        ? 'var(--ifm-color-emphasis-400, #b0b0b0)'
        : 'var(--ifm-color-success, #28a745)'};

  &:hover {
    filter: brightness(1.08);
  }
`;

export const ParamGrid = styled.div`
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--ifm-background-color, #fff);

  [data-theme='dark'] & {
    background: #1a1a1f;
  }
`;

export const ParamRow = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--ifm-color-content-secondary, #666);
`;

export const ParamName = styled.span`
  width: 90px;
  flex-shrink: 0;
`;

export const ParamSlider = styled.input`
  flex: 1;
  accent-color: var(--ifm-color-primary, #3578e5);
`;

export const ParamValue = styled.span`
  width: 54px;
  text-align: right;
  font-family: monospace;
  color: var(--ifm-color-content, #333);
`;

export const GuiHost = styled.div`
  padding: 10px;
  overflow: auto;
  max-height: 420px;
  background: var(--ifm-background-color, #fff);

  [data-theme='dark'] & {
    background: #1a1a1f;
  }
`;

export const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 12px;
`;

export const PluginCard = styled.div`
  border: 1px solid var(--ifm-color-emphasis-200, #e0e0e0);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--ifm-background-color, #fff);

  [data-theme='dark'] & {
    background: #1a1a1f;
  }
`;

export const CardThumb = styled.img`
  width: 100%;
  height: 90px;
  object-fit: cover;
  border-radius: 4px;
  background: var(--ifm-color-emphasis-100, #f0f0f0);
`;

export const CardName = styled.strong`
  font-size: 13px;
  color: var(--ifm-color-content, #333);
`;

export const CardMeta = styled.span`
  font-size: 11px;
  color: var(--ifm-color-content-secondary, #666);
`;

export const Chips = styled.div`
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
`;

export const Chip = styled.span`
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--ifm-color-emphasis-200, #e0e0e0);
  color: var(--ifm-color-content-secondary, #555);
`;

export const CardButtons = styled.div`
  display: flex;
  gap: 6px;
  margin-top: auto;
  flex-wrap: wrap;
`;

export const DisabledNote = styled.span`
  font-size: 10px;
  color: var(--ifm-color-content-secondary, #888);
  font-style: italic;
`;

export const TransportBar = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 1rem;
  background: var(--ifm-background-surface-color, #f8f9fa);
  border: 1px solid var(--ifm-color-emphasis-300, #ddd);
  border-radius: 0.25rem;
  flex-wrap: wrap;
`;
