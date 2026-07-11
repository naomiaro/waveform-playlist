import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { AnnotationData } from '@waveform-playlist/core';
import type { DawAnnotationTrackElement } from './daw-annotation-track';
import type { DawAnnotationElement } from './daw-annotation';
import type { DawAnnotationSelectDetail } from '../events';

/** m:ss.mmm for annotation timestamps (finer than the ruler's m:ss). */
function formatAnnotationTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const ms = Math.round((seconds - whole) * 1000);
  const s = whole % 60;
  const m = (whole - s) / 60;
  return m + ':' + String(s).padStart(2, '0') + '.' + String(ms).padStart(3, '0');
}

/**
 * Scrollable text panel over a <daw-annotation-track>'s children — the same
 * <daw-annotation> elements the editor lane renders (single source of truth).
 * Linked via the `for` attribute (id of the track element).
 */
@customElement('daw-annotation-list')
export class DawAnnotationListElement extends LitElement {
  @property() for = '';

  /** Suppress re-render while a row's text is being edited. */
  @state() private _editingId: string | null = null;

  private _activeId: string | null = null;
  private _observer: MutationObserver | null = null;
  private _observedTrack: DawAnnotationTrackElement | null = null;
  private _warnedMissing = false;
  /** Set around `_cancelEdit`'s `span.blur()` so the resulting synchronous
   *  blur event doesn't re-enter `_commitEdit` (cancel already restores the
   *  text and clears `_editingId` itself). */
  private _cancelling = false;

  static styles = css`
    :host {
      display: block;
      max-height: var(--daw-annotation-list-max-height, 240px);
      overflow-y: auto;
      background: var(--daw-annotation-list-background, #16213e);
      color: var(--daw-annotation-text-color, #e0d4c8);
      font-family: system-ui, sans-serif;
      font-size: 13px;
    }
    .annotation-row {
      display: flex;
      gap: 10px;
      align-items: baseline;
      padding: 6px 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      cursor: pointer;
    }
    .annotation-row.active {
      background: var(--daw-annotation-active-background, rgba(196, 154, 108, 0.25));
    }
    .annotation-row-times {
      font-variant-numeric: tabular-nums;
      font-size: 11px;
      opacity: 0.7;
      white-space: nowrap;
    }
    .annotation-row-text {
      flex: 1;
      min-width: 0;
    }
    .annotation-row-text[contenteditable='true'] {
      cursor: text;
      outline-offset: 2px;
    }
    .annotation-row-text:empty::before {
      content: '—';
      opacity: 0.4;
    }
  `;

  get track(): DawAnnotationTrackElement | null {
    if (!this.for) return null;
    const el = document.getElementById(this.for);
    if (!el || el.tagName !== 'DAW-ANNOTATION-TRACK') {
      if (!this._warnedMissing) {
        console.warn(
          el
            ? '[dawcore] <daw-annotation-list for="' +
                this.for +
                '"> target is not a <daw-annotation-track>'
            : '[dawcore] <daw-annotation-list for="' + this.for + '"> target not found'
        );
        this._warnedMissing = true;
      }
      return null;
    }
    return el as DawAnnotationTrackElement;
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    // Allow a retargeted list to warn again for its new `for` value.
    if (changed.has('for')) this._warnedMissing = false;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('daw-annotation-select', this._onSelect as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('daw-annotation-select', this._onSelect as EventListener);
    this._observer?.disconnect();
    this._observer = null;
    this._observedTrack = null;
  }

  protected shouldUpdate(): boolean {
    // Never clobber an in-progress text edit with a re-render.
    return this._editingId === null;
  }

  protected updated(): void {
    this._ensureObserver();
    this._syncRowText();
  }

  /**
   * Text content is set imperatively, NOT bound as a Lit expression.
   * contenteditable mutates the span's DOM directly as the user types —
   * that ejects lit-html's ChildPart marker comments for any binding at
   * that position, so a later Lit-driven re-render of the same row throws
   * "ChildPart has no parentNode". Keeping the span's children entirely
   * outside Lit's diffing sidesteps the crash; the (soon-to-commit) edited
   * row is skipped via the _editingId check.
   */
  private _syncRowText(): void {
    const annotations = this.track?.annotations ?? [];
    const spans = this.shadowRoot?.querySelectorAll<HTMLElement>('.annotation-row-text') ?? [];
    spans.forEach((span) => {
      const id = span.dataset.id;
      if (id === undefined || id === this._editingId) return;
      const a = annotations.find((x) => x.id === id);
      if (!a) return;
      const text = a.lines.join(' ');
      if (span.textContent !== text) span.textContent = text;
    });
  }

  /** (Re)attach the MutationObserver when the resolved track changes. */
  private _ensureObserver(): void {
    const track = this.track;
    if (track === this._observedTrack) return;
    this._observer?.disconnect();
    this._observedTrack = track;
    if (!track) return;
    this._observer = new MutationObserver(() => this.requestUpdate());
    this._observer.observe(track, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['start', 'end', 'id', 'editable'],
    });
  }

  private _onSelect = (e: CustomEvent<DawAnnotationSelectDetail>): void => {
    if (e.target !== this.track) return;
    this._activeId = e.detail.annotation?.id ?? null;
    this.requestUpdate();
    void this.updateComplete.then(() => {
      const row = this.shadowRoot?.querySelector('.annotation-row.active');
      // happy-dom lacks scrollIntoView — guard.
      (row as HTMLElement | null)?.scrollIntoView?.({ block: 'center' });
    });
  };

  private _onRowClick(a: AnnotationData): void {
    const track = this.track;
    if (!track) return;
    track.activeAnnotationId = a.id;
    const editor = track.closest('daw-editor') as { seekTo?: (t: number) => void } | null;
    editor?.seekTo?.(a.start);
  }

  private _annotationElement(id: string): DawAnnotationElement | null {
    return this.track?.annotationElements.find((el) => el.annotationId === id) ?? null;
  }

  private _commitEdit(a: AnnotationData, span: HTMLElement): void {
    // A cancel-triggered blur (span.blur() in _cancelEdit) must not commit —
    // cancel already restored the text and cleared _editingId itself.
    if (this._cancelling) return;
    this._editingId = null;
    const el = this._annotationElement(a.id);
    if (el) el.textContent = span.textContent?.trim() ?? '';
    this.requestUpdate();
  }

  private _cancelEdit(a: AnnotationData, span: HTMLElement): void {
    this._editingId = null;
    span.textContent = a.lines.join('\n');
    this._cancelling = true;
    try {
      span.blur();
    } finally {
      this._cancelling = false;
    }
    this.requestUpdate();
  }

  render() {
    const track = this.track;
    const annotations = track?.annotations ?? [];
    const editable = track?.editable ?? false;
    return html`
      ${annotations.map(
        (a) => html`
          <div
            class="annotation-row ${a.id === this._activeId ? 'active' : ''}"
            @click=${(e: Event) => {
              // Ignore clicks that land on the text span while this row is
              // ALREADY the active/selected one and mid-edit — avoids
              // re-seeking (jumping the playhead back to the row's start)
              // on every cursor-repositioning click while typing.
              //
              // Must NOT also fire on the very first click into an unselected
              // row's contenteditable text: browsers dispatch `focus` before
              // `click`, so `_editingId` is already `a.id` by the time this
              // handler runs even though `_onRowClick` (which sets it) never
              // ran yet. Gating on `_activeId === a.id` too lets that first
              // click through. (Not reproducible via `row.click()` in tests —
              // the DOM method skips the native focus-then-click sequence.)
              if (this._editingId === a.id && this._activeId === a.id) return;
              e.stopPropagation();
              this._onRowClick(a);
            }}
          >
            <span class="annotation-row-times">
              ${formatAnnotationTime(a.start)} – ${formatAnnotationTime(a.end)}
            </span>
            <span
              class="annotation-row-text"
              data-id=${a.id}
              contenteditable=${editable ? 'true' : nothing}
              @focus=${() => {
                if (editable) this._editingId = a.id;
              }}
              @blur=${(e: Event) => this._commitEdit(a, e.target as HTMLElement)}
              @keydown=${(e: KeyboardEvent) => {
                if (!editable) return;
                e.stopPropagation(); // never leak into shortcut handlers
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLElement).blur(); // blur commits
                } else if (e.key === 'Escape') {
                  this._cancelEdit(a, e.target as HTMLElement);
                }
              }}
            ></span>
          </div>
        `
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-annotation-list': DawAnnotationListElement;
  }
}
