import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { updateAnnotationBoundaries } from '@waveform-playlist/core';
import type { AnnotationData } from '@waveform-playlist/core';
import type { DawAnnotationElement } from './daw-annotation';

/** Structural view of the host editor — only what this element touches. */
interface AnnotationHostEditor extends HTMLElement {
  play(startTime?: number, endTime?: number): Promise<void>;
  seekTo(time: number): void;
  _duration: number;
}

/**
 * Write boundary-math results back to the <daw-annotation> elements —
 * only edges that actually changed, so no spurious daw-annotation-update
 * events fire. Module-level helper (must sit ABOVE @customElement per the
 * dawcore decorator gotcha) — exported for reuse by the drag interaction.
 */
export function applyBoundaryResults(
  elements: DawAnnotationElement[],
  before: AnnotationData[],
  after: AnnotationData[]
): void {
  after.forEach((next, i) => {
    if (next.start !== before[i].start) elements[i].start = next.start;
    if (next.end !== before[i].end) elements[i].end = next.end;
  });
}

/**
 * Declarative annotation track (light DOM). Children are <daw-annotation>
 * elements — their attributes are the single source of truth. This element
 * owns the ephemeral selection state and the programmatic API; the host
 * <daw-editor> renders the timeline lane, <daw-annotation-list> renders the
 * text panel.
 */
@customElement('daw-annotation-track')
export class DawAnnotationTrackElement extends LitElement {
  @property({ type: Boolean, reflect: true }) editable = false;
  @property({ type: Boolean, reflect: true, attribute: 'link-endpoints' }) linkEndpoints = false;
  @property({ type: Boolean, reflect: true, attribute: 'continuous-play' }) continuousPlay = false;
  @property({ type: Boolean, reflect: true, attribute: 'keyboard-controls' })
  keyboardControls = false;

  // --- Selection (ephemeral UI state — deliberately NOT DOM data) ---

  private _activeAnnotationId: string | null = null;

  get activeAnnotationId(): string | null {
    return this._activeAnnotationId;
  }

  set activeAnnotationId(value: string | null) {
    if (value !== null && !this.annotationElements.some((el) => el.annotationId === value)) {
      console.warn(
        '[dawcore] daw-annotation-track: unknown annotation id "' + value + '" — selection ignored'
      );
      return;
    }
    if (value === this._activeAnnotationId) return;
    this._activeAnnotationId = value;
    const active = this._activeElement();
    this.dispatchEvent(
      new CustomEvent('daw-annotation-select', {
        bubbles: true,
        composed: true,
        detail: { annotation: active ? active.toAnnotationData() : null },
      })
    );
  }

  // --- Child access ---

  /** Child annotation elements, sorted by start time. */
  get annotationElements(): DawAnnotationElement[] {
    return Array.from(this.querySelectorAll<DawAnnotationElement>(':scope > daw-annotation')).sort(
      (a, b) => a.start - b.start
    );
  }

  get annotations(): AnnotationData[] {
    return this.annotationElements.map((el) => el.toAnnotationData());
  }

  // --- Navigation methods (spec API) ---

  selectNext(): void {
    this._selectByOffset(1, 0);
  }

  selectPrevious(): void {
    this._selectByOffset(-1, -1);
  }

  selectFirst(): void {
    const list = this.annotationElements;
    if (list.length > 0) this.activeAnnotationId = list[0].annotationId;
  }

  selectLast(): void {
    const list = this.annotationElements;
    if (list.length > 0) this.activeAnnotationId = list[list.length - 1].annotationId;
  }

  clearSelection(): void {
    this.activeAnnotationId = null;
  }

  /** offset: +1 next / -1 previous; noSelectionIndex: 0 → first, -1 → last. */
  private _selectByOffset(offset: number, noSelectionIndex: number): void {
    const list = this.annotationElements;
    if (list.length === 0) return;
    const currentIndex = list.findIndex((el) => el.annotationId === this._activeAnnotationId);
    const nextIndex =
      currentIndex === -1
        ? (noSelectionIndex + list.length) % list.length
        : (currentIndex + offset + list.length) % list.length;
    this.activeAnnotationId = list[nextIndex].annotationId;
  }

  // --- Playback (spec API) ---

  playActive(): void {
    const active = this._activeElement();
    if (!active) return;
    const editor = this._hostEditor();
    if (!editor) {
      console.warn(
        '[dawcore] <daw-annotation-track> playActive: no parent <daw-editor> — call ignored'
      );
      return;
    }
    const data = active.toAnnotationData();
    void editor.play(data.start, this.continuousPlay ? undefined : data.end);
  }

  // --- Boundary editing (spec API) ---

  moveStartBoundary(deltaMs: number): void {
    this._moveBoundary(deltaMs, true);
  }

  moveEndBoundary(deltaMs: number): void {
    this._moveBoundary(deltaMs, false);
  }

  private _moveBoundary(deltaMs: number, isStart: boolean): void {
    if (!this.editable) {
      console.warn(
        '[dawcore] daw-annotation-track: boundary editing requires the editable attribute'
      );
      return;
    }
    const elements = this.annotationElements;
    const index = elements.findIndex((el) => el.annotationId === this._activeAnnotationId);
    if (index === -1) return;
    const data = elements.map((el) => el.toAnnotationData());
    const edge = isStart ? data[index].start : data[index].end;
    const updated = updateAnnotationBoundaries({
      annotationIndex: index,
      newTime: edge + deltaMs / 1000,
      isDraggingStart: isStart,
      annotations: data,
      duration: this._timelineDuration(),
      linkEndpoints: this.linkEndpoints,
    });
    applyBoundaryResults(elements, data, updated);
  }

  private _timelineDuration(): number {
    return this._hostEditor()?._duration ?? Infinity;
  }

  private _activeElement(): DawAnnotationElement | null {
    if (this._activeAnnotationId === null) return null;
    return (
      this.annotationElements.find((el) => el.annotationId === this._activeAnnotationId) ?? null
    );
  }

  private _hostEditor(): AnnotationHostEditor | null {
    return this.closest('daw-editor') as AnnotationHostEditor | null;
  }

  // --- Lifecycle ---

  private _childObserver: MutationObserver | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    setTimeout(() => {
      this.dispatchEvent(
        new CustomEvent('daw-annotation-track-connected', {
          bubbles: true,
          composed: true,
          detail: { element: this },
        })
      );
    }, 0);
    // Clear selection when the active annotation element is removed.
    this._childObserver = new MutationObserver(() => {
      if (
        this._activeAnnotationId !== null &&
        !this.annotationElements.some((el) => el.annotationId === this._activeAnnotationId)
      ) {
        this.activeAnnotationId = null;
      }
    });
    this._childObserver.observe(this, { childList: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._childObserver?.disconnect();
    this._childObserver = null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-annotation-track': DawAnnotationTrackElement;
  }
}
