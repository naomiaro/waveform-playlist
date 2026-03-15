import { LitElement, css } from 'lit';
import type { DawTransportElement } from './daw-transport';

/**
 * Base class for transport button elements.
 * Finds target daw-editor via closest <daw-transport>.
 */
export class DawTransportButton extends LitElement {
  protected get target(): any {
    const transport = this.closest('daw-transport') as DawTransportElement | null;
    return transport?.target ?? null;
  }

  static styles = css`
    button {
      cursor: pointer;
      background: var(--daw-controls-background, #1a1a2e);
      color: var(--daw-controls-text, #e0d4c8);
      border: 1px solid currentColor;
      padding: 4px 8px;
      font: inherit;
    }
    button:hover {
      opacity: 0.8;
    }
    button:disabled {
      opacity: 0.4;
      cursor: default;
    }
  `;
}
