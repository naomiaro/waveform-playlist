import { LitElement, css } from 'lit';
import {
  resolveTransportTarget,
  targetSupports,
  targetUndetermined,
  warnNoTargetOnce,
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

  /**
   * False when this control declares requirements its target doesn't meet.
   * An undetermined target (missing, or a not-yet-upgraded custom element)
   * gets the benefit of the doubt and stays enabled — click-time resolution
   * warns if it's still unusable.
   */
  protected get targetSupported(): boolean {
    const required = this._requiredMethods;
    if (required.length === 0) return true;
    const target = this.target;
    if (targetUndetermined(target)) return true;
    return targetSupports(target, required);
  }

  connectedCallback() {
    super.connectedCallback();
    // Disabled inner buttons swallow clicks — listen on the host so an
    // unsupported control still explains itself on first interaction.
    this.addEventListener('pointerdown', this._onCapabilityPointerDown);
    // A target that became resolvable since the last render should
    // re-evaluate before the click lands.
    this.addEventListener('pointerenter', this._onCapabilityPointerEnter);
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
    this.removeEventListener('pointerenter', this._onCapabilityPointerEnter);
  }

  private _onCapabilityPointerEnter = () => {
    this.requestUpdate();
  };

  private _onCapabilityPointerDown = () => {
    const target = this.target;
    if (!target) {
      // A control with requirements stays enabled when the target is missing
      // (benefit of the doubt) — without this warn, a bad <daw-transport for>
      // id would be silent. Controls with no requirements warn in their own
      // click handlers instead.
      if (this._requiredMethods.length > 0) {
        warnNoTargetOnce(this);
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
