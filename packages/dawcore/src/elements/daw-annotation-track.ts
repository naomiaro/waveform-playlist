import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  updateAnnotationBoundaries,
  resolveAnnotationShortcuts,
  matchesKeyBinding,
  ANNOTATION_LINK_THRESHOLD_TICKS,
  annotationMinDurationTicks,
} from '@waveform-playlist/core';
import type {
  AnnotationData,
  AnnotationShortcutMap,
  AnnotationShortcutAction,
  KeyBinding,
} from '@waveform-playlist/core';
import type { DawAnnotationElement } from './daw-annotation';

/** Structural view of the host editor — only what this element touches. */
interface AnnotationHostEditor extends HTMLElement {
  play(startTime?: number, endTime?: number): Promise<void>;
  seekTo(time: number): void;
  _annotationClampDuration: number;
  _secondsToTicks(seconds: number): number;
  _ticksToSeconds(ticks: number): number;
  ppqn: number;
}

/**
 * Write boundary-math results back to the <daw-annotation> elements —
 * only edges that actually changed, so no spurious daw-annotation-update
 * events fire. Module-level helper (must sit ABOVE @customElement per the
 * dawcore decorator gotcha) — exported for reuse by the drag interaction.
 *
 * `before`/`after` are index-aligned with EACH OTHER (the core boundary math
 * preserves input order), but `elements` is a live, start-sorted snapshot
 * (`track.annotationElements` re-sorts on every access) that can disagree
 * with the snapshot order the caller computed `before`/`after` from — e.g.
 * mid-drag, once a dragged start edge crosses a neighbor's start. Matching
 * `elements[i]` by POSITION would then silently write results onto the
 * wrong element. Look up the target element by `after[i].id` instead.
 */
export function applyBoundaryResults(
  elements: DawAnnotationElement[],
  before: AnnotationData[],
  after: AnnotationData[]
): void {
  const byId = new Map(elements.map((el) => [el.annotationId, el]));
  after.forEach((next, i) => {
    const el = byId.get(next.id);
    if (!el) return;
    if (next.start !== before[i].start) el.start = next.start;
    if (next.end !== before[i].end) el.end = next.end;
  });
}

/**
 * Tick-space sibling of applyBoundaryResults: `before`/`after` carry TICK
 * values in start/end. Id-matched targets; a tick-based element gets rounded
 * integer ticks PLUS a re-derived seconds cache (single write pass keeps both
 * units coherent); a seconds-based element (converted in for mixed-track link
 * math) gets seconds back in ITS authoritative unit and never gains tick attrs.
 */
export function applyTickBoundaryResults(
  elements: DawAnnotationElement[],
  before: AnnotationData[],
  after: AnnotationData[],
  ticksToSeconds: (ticks: number) => number
): void {
  const byId = new Map(elements.map((el) => [el.annotationId, el]));
  after.forEach((next, i) => {
    const el = byId.get(next.id);
    if (!el) return;
    const startChanged = next.start !== before[i].start;
    const endChanged = next.end !== before[i].end;
    if (!startChanged && !endChanged) return;
    if (el.isTickBased) {
      if (startChanged) {
        const tick = Math.round(next.start);
        el.startTick = tick;
        el.start = ticksToSeconds(tick);
      }
      if (endChanged) {
        const tick = Math.round(next.end);
        el.endTick = tick;
        el.end = ticksToSeconds(tick);
      }
    } else {
      if (startChanged) el.start = ticksToSeconds(next.start);
      if (endChanged) el.end = ticksToSeconds(next.end);
    }
  });
}

/** Map an annotation element into tick-space AnnotationData: tick-based
 * elements use their authoritative ticks; seconds-based neighbors are
 * converted so mixed-track link/collision math runs in one unit space. */
export function tickSpaceData(
  el: DawAnnotationElement,
  editor: { _secondsToTicks(seconds: number): number }
): AnnotationData {
  const base = el.toAnnotationData();
  if (el.isTickBased) {
    return { ...base, start: base.startTick as number, end: base.endTick as number };
  }
  return {
    ...base,
    start: editor._secondsToTicks(base.start),
    end: editor._secondsToTicks(base.end),
  };
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
  /** Lane box label mode: 'text' (default) | 'id' (sonnet-style: explicit id
   * attribute, else 1-based position) | 'none' (pure region bars). The list
   * always shows full text — this only affects the timeline lane. */
  @property({ reflect: true, attribute: 'box-label' }) boxLabel: 'text' | 'id' | 'none' = 'text';
  /** Display label for the editor's controls-column lane row (mirrors
   * <daw-track name>). Empty = blank spacer (opt-in, no layout change). */
  @property({ reflect: true }) name = '';

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
    const active = elements[index];

    if (active.isTickBased) {
      const editor = this._hostEditor();
      if (!editor) {
        console.warn(
          '[dawcore] daw-annotation-track: tick-based boundary edits need a parent <daw-editor> for tempo conversion — call ignored'
        );
        return;
      }
      // Tick space: siblings converted in; ms delta converted at the edge's
      // local tempo (correct under variable-tempo callbacks).
      const tickData = elements.map((el) => tickSpaceData(el, editor));
      const edgeTick = isStart ? tickData[index].start : tickData[index].end;
      const edgeSeconds = editor._ticksToSeconds(edgeTick);
      const deltaTicks =
        editor._secondsToTicks(edgeSeconds + deltaMs / 1000) - editor._secondsToTicks(edgeSeconds);
      const clamp = this._timelineDuration();
      const updated = updateAnnotationBoundaries(
        {
          annotationIndex: index,
          newTime: edgeTick + deltaTicks,
          isDraggingStart: isStart,
          annotations: tickData,
          duration: clamp === Infinity ? Infinity : editor._secondsToTicks(clamp),
          linkEndpoints: this.linkEndpoints,
        },
        {
          linkThreshold: ANNOTATION_LINK_THRESHOLD_TICKS,
          minDuration: annotationMinDurationTicks(editor.ppqn),
        }
      );
      applyTickBoundaryResults(elements, tickData, updated, (t) => editor._ticksToSeconds(t));
      return;
    }

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
    return this._hostEditor()?._annotationClampDuration ?? Infinity;
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

  // --- Keyboard remapping (accessor pair: cache invalidation on set) ---

  private _annotationShortcuts: AnnotationShortcutMap | null = null;
  private _resolvedShortcuts: Array<{
    action: AnnotationShortcutAction;
    binding: KeyBinding;
  }> | null = null;

  get annotationShortcuts(): AnnotationShortcutMap | null {
    return this._annotationShortcuts;
  }
  set annotationShortcuts(value: AnnotationShortcutMap | null) {
    this._annotationShortcuts = value;
    this._resolvedShortcuts = null;
  }

  private _shortcutEntries(): Array<{ action: AnnotationShortcutAction; binding: KeyBinding }> {
    if (!this._resolvedShortcuts) {
      this._resolvedShortcuts = resolveAnnotationShortcuts(this._annotationShortcuts);
    }
    return this._resolvedShortcuts;
  }

  private static readonly _boundaryActions: ReadonlySet<AnnotationShortcutAction> = new Set([
    'moveStartEarlier',
    'moveStartLater',
    'moveEndEarlier',
    'moveEndLater',
  ]);

  // Capture phase: runs before <daw-keyboard-shortcuts>' bubble-phase listener,
  // giving annotation shortcuts deterministic priority (spec rule).
  private _onKeyDownCapture = (e: KeyboardEvent): void => {
    if (!this.keyboardControls) return;
    if (e.repeat) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    const match = this._shortcutEntries().find((entry) => matchesKeyBinding(e, entry.binding));
    if (!match) return;

    const hasSelection = this._activeAnnotationId !== null;
    // Escape with no selection falls through so a second press reaches the
    // editor's stop shortcut (spec two-press rule).
    if (match.action === 'clearSelection' && !hasSelection) return;
    // Boundary editing requires editable + a selection; don't eat keys otherwise.
    if (DawAnnotationTrackElement._boundaryActions.has(match.action)) {
      if (!this.editable || !hasSelection) return;
    }
    if (match.action === 'playActive' && !hasSelection) return;

    e.preventDefault();
    // stopImmediatePropagation (not stopPropagation): multiple
    // <daw-annotation-track keyboard-controls> elements each register their
    // own capture listener on `document`, and stopPropagation does NOT stop
    // sibling listeners on the same node — only stopImmediatePropagation
    // does (it also implies stopPropagation). Without it, one keypress would
    // act on every annotation track at once. This makes a consumed key act
    // on exactly the first-registered track (DOM order) and also prevents
    // bubble-phase editor shortcuts from firing. Unconsumed keys (Escape
    // with no selection, gated boundary keys) still fall through everywhere
    // via the early returns above.
    e.stopImmediatePropagation();
    try {
      this._runShortcutAction(match.action);
    } catch (err) {
      console.warn('[dawcore] Annotation shortcut failed (key=' + e.key + '): ' + String(err));
      this.dispatchEvent(
        new CustomEvent('daw-error', {
          bubbles: true,
          composed: true,
          detail: { operation: 'annotation-shortcut', key: e.key, error: err },
        })
      );
    }
  };

  private _runShortcutAction(action: AnnotationShortcutAction): void {
    switch (action) {
      case 'selectPrevious':
        this.selectPrevious();
        break;
      case 'selectNext':
        this.selectNext();
        break;
      case 'selectFirst':
        this.selectFirst();
        break;
      case 'selectLast':
        this.selectLast();
        break;
      case 'clearSelection':
        this.clearSelection();
        break;
      case 'moveStartEarlier':
        this.moveStartBoundary(-10);
        break;
      case 'moveStartLater':
        this.moveStartBoundary(10);
        break;
      case 'moveEndEarlier':
        this.moveEndBoundary(-10);
        break;
      case 'moveEndLater':
        this.moveEndBoundary(10);
        break;
      case 'playActive':
        this.playActive();
        break;
    }
  }

  // --- Lifecycle ---

  private _childObserver: MutationObserver | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    // Data element — its light-DOM text must not render through a host's
    // bare <slot> (e.g. <daw-editor>'s). Views (editor lane,
    // <daw-annotation-list>) present it instead.
    this.style.display = 'none';
    // Upgrade-property dance: a remap assigned before element definition
    // created an own property shadowing the accessor — re-route it.
    if (Object.prototype.hasOwnProperty.call(this, 'annotationShortcuts')) {
      const value = (this as Record<string, unknown>)['annotationShortcuts'];
      delete (this as Record<string, unknown>)['annotationShortcuts'];
      this.annotationShortcuts = value as AnnotationShortcutMap | null;
    }
    document.addEventListener('keydown', this._onKeyDownCapture, true); // capture phase
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
    document.removeEventListener('keydown', this._onKeyDownCapture, true);
    this._childObserver?.disconnect();
    this._childObserver = null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-annotation-track': DawAnnotationTrackElement;
  }
}
