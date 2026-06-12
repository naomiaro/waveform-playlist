import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  resolveTransportTarget,
  targetSupports,
  targetUndetermined,
  warnNoTargetOnce,
  warnUnsupportedOnce,
} from '../utils/transport-capability';
import {
  TIME_DISPLAY_FORMATS,
  isTimeDisplayFormat,
  type TimeDisplayFormat,
} from '../utils/time-display-format';
import type { DawEvent } from '../events';

/**
 * Time format select for <daw-transport>. Sets the format ON the target
 * (`target.setTimeFormat(...)`) — the target owns the state (native-form
 * style), and every display/input syncs via the bubbled
 * `daw-time-format-change` event. Renders disabled when the target doesn't
 * implement setTimeFormat (duck-typed capability detection, #474).
 */
@customElement('daw-time-format')
export class DawTimeFormatElement extends LitElement {
  @state() private _format: TimeDisplayFormat = 'hh:mm:ss.sss';

  static styles = css`
    select {
      cursor: pointer;
      background: var(--daw-controls-background, #1a1a2e);
      color: var(--daw-controls-text, #e0d4c8);
      border: 1px solid currentColor;
      padding: 4px 8px;
      font: inherit;
    }
    select:disabled {
      opacity: 0.4;
      cursor: default;
    }
  `;

  private get target(): HTMLElement | null {
    return resolveTransportTarget(this);
  }

  /**
   * False when the target doesn't implement setTimeFormat. An undetermined
   * target (missing, or a not-yet-upgraded custom element) gets the benefit
   * of the doubt and stays enabled — interaction-time resolution warns if
   * it's still unusable.
   */
  private get _targetSupported(): boolean {
    const target = this.target;
    if (targetUndetermined(target)) return true;
    return targetSupports(target, ['setTimeFormat']);
  }

  private _onFormatChange = (e: Event) => {
    if (e.target !== this.target) return;
    const detail = (e as DawEvent<'daw-time-format-change'>).detail;
    if (isTimeDisplayFormat(detail.format)) {
      this._format = detail.format;
    }
  };

  private _onPointerEnter = () => {
    // A target that became resolvable since the last render should
    // re-evaluate before the click lands.
    this.requestUpdate();
  };

  private _onPointerDown = () => {
    const target = this.target;
    if (!target) {
      warnNoTargetOnce(this);
      return;
    }
    if (!this._targetSupported) {
      warnUnsupportedOnce(this, ['setTimeFormat']);
    }
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('daw-time-format-change', this._onFormatChange);
    this.addEventListener('pointerdown', this._onPointerDown);
    this.addEventListener('pointerenter', this._onPointerEnter);
    // Defer until the transport target has upgraded, then sync + re-render.
    requestAnimationFrame(() => {
      if (!this.isConnected) return;
      const target = this.target as (HTMLElement & { timeFormat?: unknown }) | null;
      if (target && isTimeDisplayFormat(target.timeFormat)) {
        this._format = target.timeFormat;
      }
      this.requestUpdate();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('daw-time-format-change', this._onFormatChange);
    this.removeEventListener('pointerdown', this._onPointerDown);
    this.removeEventListener('pointerenter', this._onPointerEnter);
  }

  protected updated() {
    // <option selected> attribute toggles stop working once the user has
    // picked an option (HTML selectedness dirtiness) — sync the IDL value
    // imperatively so programmatic format changes always reflect.
    const select = this.shadowRoot?.querySelector('select');
    if (select && select.value !== this._format) {
      select.value = this._format;
    }
  }

  private _onSelectChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as TimeDisplayFormat;
    const target = this.target as (HTMLElement & { setTimeFormat?: (f: string) => void }) | null;
    if (!target) {
      // Stale-render race guard: the target can vanish between render and change.
      warnNoTargetOnce(this);
      return;
    }
    target.setTimeFormat?.(value);
  }

  render() {
    return html`
      <select
        aria-label="Time format"
        ?disabled=${!this._targetSupported}
        @change=${this._onSelectChange}
      >
        ${TIME_DISPLAY_FORMATS.map(
          (f) => html`<option value=${f} ?selected=${f === this._format}>${f}</option>`
        )}
      </select>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-time-format': DawTimeFormatElement;
  }
}
