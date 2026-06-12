import { LitElement, css } from 'lit';
import {
  resolveTransportTarget,
  targetSupports,
  warnOnce,
  warnUnsupportedOnce,
} from '../utils/transport-capability';

/**
 * Base class for transport button elements.
 * Finds target via closest <daw-transport>. Capability detection is
 * duck-typed (#474): subclasses declare requiredTargetMethods and render
 * `?disabled=${!this.targetSupported}`; targets lacking the methods get a
 * disabled control and a one-time console warning on interaction.
 */
export class DawTransportButton extends LitElement {
  /** Methods the transport target must implement for this control to be
   *  enabled. Empty = works with any target. */
  protected static requiredTargetMethods: readonly string[] = [];

  protected get target(): any {
    return resolveTransportTarget(this);
  }

  private get _requiredMethods(): readonly string[] {
    return (this.constructor as typeof DawTransportButton).requiredTargetMethods;
  }

  /** False when this control declares requirements its target doesn't meet. */
  protected get targetSupported(): boolean {
    const required = this._requiredMethods;
    if (required.length === 0) return true;
    return targetSupports(this.target, required);
  }

  connectedCallback() {
    super.connectedCallback();
    // Disabled inner buttons swallow clicks — listen on the host so an
    // unsupported control still explains itself on first interaction.
    this.addEventListener('pointerdown', this._onCapabilityPointerDown);
    // The transport `for` id resolves after connect (target may upgrade
    // later) — re-render once it's resolvable so disabled state is accurate.
    requestAnimationFrame(() => {
      if (!this.isConnected) return;
      this.requestUpdate();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('pointerdown', this._onCapabilityPointerDown);
  }

  private _onCapabilityPointerDown = () => {
    const target = this.target;
    if (!target) {
      // A control with requirements renders disabled when the target is
      // missing — without this warn, a bad <daw-transport for> id would be
      // silent. Controls with no requirements stay enabled and warn in their
      // own click handlers instead.
      if (this._requiredMethods.length > 0) {
        warnOnce(
          this,
          `[dawcore] <${this.tagName.toLowerCase()}> has no target. Check <daw-transport for="..."> references a valid element id.`
        );
      }
      return;
    }
    if (!this.targetSupported) {
      warnUnsupportedOnce(this, this._requiredMethods);
    }
  };

  static styles: import('lit').CSSResultGroup = css`
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
