import { css } from 'lit';

/**
 * Default CSS custom properties for dawcore elements.
 * Consumers override these on <daw-editor> or any ancestor.
 * Values inherit through Shadow DOM boundaries automatically.
 */
export const hostStyles = css`
  :host {
    --daw-wave-color: #c49a6c;
    --daw-progress-color: #63c75f;
    --daw-playhead-color: #d08070;
    --daw-background: #1a1a2e;
    --daw-track-background: #16213e;
    --daw-ruler-color: #c49a6c;
    --daw-ruler-background: #0f0f1a;
    --daw-controls-background: #1a1a2e;
    --daw-controls-text: #e0d4c8;
    --daw-selection-color: rgba(99, 199, 95, 0.3);
    --daw-clip-header-background: rgba(0, 0, 0, 0.4);
    --daw-clip-header-text: #e0d4c8;
  }
`;

/** Clip container and header styles for the editor timeline. */
export const clipStyles = css`
  .clip-container {
    position: absolute;
    overflow: hidden;
  }
  .clip-header {
    position: relative;
    z-index: 1;
    height: 20px;
    background: var(--daw-clip-header-background, rgba(0, 0, 0, 0.4));
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    padding: 0 6px;
    user-select: none;
  }
  .clip-header span {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.02em;
    font-family: system-ui, sans-serif;
    color: var(--daw-clip-header-text, #e0d4c8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.8;
  }
`;
