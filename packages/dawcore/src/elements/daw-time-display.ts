import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { resolveTransportTarget, warnNoTargetOnce } from '../utils/transport-capability';
import {
  formatDisplayTime,
  isTimeDisplayFormat,
  type TimeDisplayFormat,
} from '../utils/time-display-format';
import type { DawEvent } from '../events';

/**
 * Formatted playback time readout for <daw-transport>.
 *
 * Subscribes to bubbled `daw-timeupdate` / `daw-time-format-change` events at
 * the document level and filters by its transport target — works with any
 * target that dispatches them (<daw-editor> today, <daw-player> later) and
 * tolerates targets that upgrade after this element connects.
 *
 * Accessibility (spec): role="status", aria-live="off" — not announced every
 * frame; screen reader users query on demand.
 */
@customElement('daw-time-display')
export class DawTimeDisplayElement extends LitElement {
  /** Null until the first successful target sync or daw-timeupdate. */
  @state() private _time: number | null = null;
  @state() private _format: TimeDisplayFormat = 'hh:mm:ss.sss';

  static styles = css`
    span {
      display: inline-block;
      font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
      font-variant-numeric: tabular-nums;
      color: var(--daw-controls-text, #e0d4c8);
      background: var(--daw-controls-background, #1a1a2e);
      border: 1px solid currentColor;
      padding: 4px 8px;
    }
  `;

  private get target(): HTMLElement | null {
    return resolveTransportTarget(this);
  }

  private _onTimeUpdate = (e: Event) => {
    if (e.target !== this.target) return;
    if (this._time === null) {
      // Late-target recovery: pick up the format we missed at connect time.
      const timeFormat = (e.target as HTMLElement & { timeFormat?: unknown }).timeFormat;
      if (isTimeDisplayFormat(timeFormat)) this._format = timeFormat;
    }
    this._time = (e as DawEvent<'daw-timeupdate'>).detail.time;
  };

  private _onFormatChange = (e: Event) => {
    if (e.target !== this.target) return;
    const detail = (e as DawEvent<'daw-time-format-change'>).detail;
    if (isTimeDisplayFormat(detail.format)) {
      this._format = detail.format;
    }
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('daw-timeupdate', this._onTimeUpdate);
    document.addEventListener('daw-time-format-change', this._onFormatChange);
    // Defer the initial read until <daw-transport for> and the target have
    // upgraded (same pattern as the transport buttons).
    requestAnimationFrame(() => this._syncFromTarget());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('daw-timeupdate', this._onTimeUpdate);
    document.removeEventListener('daw-time-format-change', this._onFormatChange);
  }

  private _syncFromTarget() {
    if (!this.isConnected) return;
    const target = this.target;
    if (!target || typeof (target as { currentTime?: unknown }).currentTime !== 'number') {
      warnNoTargetOnce(
        this,
        ' The display recovers automatically once the target dispatches daw-timeupdate.'
      );
      return;
    }
    this._time = (target as unknown as { currentTime: number }).currentTime;
    const fmt = (target as { timeFormat?: unknown }).timeFormat;
    if (isTimeDisplayFormat(fmt)) {
      this._format = fmt;
    }
  }

  render() {
    const text = this._time === null ? '--:--:--' : formatDisplayTime(this._time, this._format);
    return html`<span role="status" aria-label="Playback time" aria-live="off">${text}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-time-display': DawTimeDisplayElement;
  }
}
