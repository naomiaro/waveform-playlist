import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import type { RenderMode, SpectrogramConfig, TrackKind } from '@waveform-playlist/core';
import type { EffectState as TrackEffectState, SerializedEffectEntry } from '../effects/types';
import { normalizeRenderMode } from '../types';
import type { DawTrackUpdateDetail } from '../events';
import {
  detachedWarning,
  linkHostOf,
  setCustomState,
  type TrackLinkValues,
} from '../interactions/element-links';

/** The properties whose change the editor hears about (`daw-track-update`). */
const TRACK_PROPS: readonly string[] = [
  'volume',
  'pan',
  'muted',
  'soloed',
  'src',
  'name',
  'kind',
  'renderMode',
  'spectrogramConfig',
];

/** Structural view of the editor's public per-track effects API (keyed by
 *  trackId) — avoids a value-import cycle between daw-track and daw-editor.
 *  These are the same methods consumers can call directly on <daw-editor> for
 *  element-less (drag-dropped / programmatic) tracks; the element just supplies
 *  its own trackId. */
interface TrackEffectsDelegate {
  addTrackEffect(trackId: string, type: string, params?: Record<string, number>): string;
  trackEffects(trackId: string): TrackEffectState[];
  removeTrackEffect(trackId: string, effectId: string): void;
  setTrackEffectParams(trackId: string, effectId: string, params: Record<string, number>): void;
  setTrackEffectBypassed(trackId: string, effectId: string, bypassed: boolean): void;
  moveTrackEffect(trackId: string, effectId: string, newIndex: number): void;
  addTrackWamPlugin(trackId: string, url: string, initialState?: unknown): Promise<string>;
  addTrackFaustEffect(
    trackId: string,
    dspCode: string,
    options?: { name?: string }
  ): Promise<string>;
  openTrackEffectGui(
    trackId: string,
    effectId: string,
    container: HTMLElement
  ): Promise<HTMLElement>;
  closeTrackEffectGui(trackId: string, effectId: string): void;
  getTrackEffectsState(trackId: string): Promise<SerializedEffectEntry[]>;
  setTrackEffectsState(trackId: string, entries: SerializedEffectEntry[]): Promise<void>;
}

@customElement('daw-track')
export class DawTrackElement extends LitElement {
  @property() src = '';

  // --- Live properties (#848): the arrangement's values while the track is
  // in it; the declaration (attributes, a set before entry) otherwise. ---

  /** The track's name: the arrangement's, or as declared. Setting it renames the track (an undo step). */
  @property({ noAccessor: true })
  get name(): string {
    return this._linked('name');
  }
  set name(value: string) {
    this._request('name', value ?? '');
  }
  @property({ type: Number, noAccessor: true })
  get volume(): number {
    return this._linked('volume');
  }
  set volume(value: number) {
    this._request('volume', value);
  }
  @property({ type: Number, noAccessor: true })
  get pan(): number {
    return this._linked('pan');
  }
  set pan(value: number) {
    this._request('pan', value);
  }
  /** The stored mute (a take's mute is not shown here). */
  @property({ type: Boolean, noAccessor: true })
  get muted(): boolean {
    return this._linked('muted');
  }
  set muted(value: boolean) {
    this._request('muted', Boolean(value));
  }
  @property({ type: Boolean, noAccessor: true })
  get soloed(): boolean {
    return this._linked('soloed');
  }
  set soloed(value: boolean) {
    this._request('soloed', Boolean(value));
  }

  /** The track's position in the arrangement the editor plays; -1 when it is not there. */
  get index(): number {
    return linkHostOf(this)?._trackIndex(this.trackId) ?? -1;
  }

  /** What the page declared: the attributes, and a property set before the track entered. */
  private _declared: TrackLinkValues = { name: '', volume: 1, pan: 0, muted: false, soloed: false };
  private _fromAttribute = false;
  private _internals: ElementInternals | null = this.attachInternals?.() ?? null;

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    // An attribute is the declaration, whatever the link state.
    this._fromAttribute = true;
    try {
      super.attributeChangedCallback(name, old, value);
    } finally {
      this._fromAttribute = false;
    }
  }

  private _linked<K extends keyof TrackLinkValues>(key: K): TrackLinkValues[K] {
    const host = linkHostOf(this);
    const live =
      host?._trackLinkState(this.trackId) === 'live' ? host._trackValues(this.trackId) : null;
    return live ? live[key] : this._declared[key];
  }

  private _request<K extends keyof TrackLinkValues>(key: K, value: TrackLinkValues[K]): void {
    const old = this._linked(key);
    const host = linkHostOf(this);
    const state = host?._trackLinkState(this.trackId) ?? 'pending';
    if (this._fromAttribute || state === 'pending') {
      this._declared = { ...this._declared, [key]: value };
    }
    if (state === 'live') {
      host!._requestTrackChange(this.trackId, { [key]: value } as Partial<TrackLinkValues>);
    } else if (state === 'detached') {
      const label = '<daw-track name="' + this._declared.name + '">';
      console.warn(detachedWarning(label, key + ' = ' + String(value), host!._detachedReason()));
    }
    this.requestUpdate(key, old);
  }

  /** @internal Shown as `:state(detached)` (#848). */
  _setDetached(detached: boolean): void {
    setCustomState(this._internals, 'detached', detached);
  }

  /**
   * What the track holds: `'audio'` (default) or `'midi'`. Every `<daw-clip>`
   * child must be of this kind (#756). Set it before the track enters: the
   * editor reads it then. Live (#848): once the track has entered, it reads
   * the track's kind, which cannot change; a later change keeps the attribute
   * (the page's declaration) and warns.
   */
  @property({ reflect: true, noAccessor: true })
  get kind(): TrackKind {
    const host = linkHostOf(this);
    const live =
      host?._trackLinkState(this.trackId) === 'live' ? host._trackKind(this.trackId) : null;
    return live ?? this._kind;
  }
  set kind(value: TrackKind) {
    const host = linkHostOf(this);
    const live =
      host?._trackLinkState(this.trackId) === 'live' ? host._trackKind(this.trackId) : null;
    if (live && value !== live) {
      console.warn(
        '[dawcore] <daw-track> "' +
          (this._declared.name || 'Untitled') +
          '": kind cannot change after the track has loaded (still "' +
          live +
          '"). Remove the track and add one of the other kind.'
      );
      // The attribute is the page's declaration: it keeps what was written.
      if (!this._fromAttribute) return;
    }
    if (value !== 'audio' && value !== 'midi') {
      console.warn(
        '[dawcore] <daw-track kind="' +
          String(value) +
          "\"> is not a track kind ('audio' or 'midi'); keeping \"" +
          this._kind +
          '"'
      );
      return;
    }
    const old = this._kind;
    this._kind = value;
    this.requestUpdate('kind', old);
  }
  private _kind: TrackKind = 'audio';

  // Custom getter/setter so we can warn-and-fallback on 'both' (dawcore
  // doesn't yet support rendering waveform + spectrogram simultaneously).
  @property({ attribute: 'render-mode', noAccessor: true })
  get renderMode(): RenderMode {
    return this._renderMode;
  }
  set renderMode(value: RenderMode) {
    const old = this._renderMode;
    // From markup the value is any string, and null when the attribute is
    // removed.
    let next = normalizeRenderMode(value);
    if (next === 'both') {
      console.warn(
        '[dawcore] <daw-track render-mode="both"> is not yet supported; falling back to \'spectrogram\''
      );
      next = 'spectrogram';
    }
    this._renderMode = next;
    this.requestUpdate('renderMode', old);
  }
  private _renderMode: RenderMode = 'waveform';

  @property({ attribute: false }) spectrogramConfig: SpectrogramConfig | null = null;

  readonly trackId = crypto.randomUUID();

  // Light DOM so <daw-clip> children are queryable.
  createRenderRoot() {
    return this;
  }

  // --- Effects API (delegates to the owning <daw-editor>) ---

  addEffect(type: string, params?: Record<string, number>): string {
    return this._effectsEditor().addTrackEffect(this.trackId, type, params);
  }

  /** Load a WAM plugin (via the optional @dawcore/wam peer) into this track's chain. */
  addWamPlugin(url: string, initialState?: unknown): Promise<string> {
    return this._effectsEditor().addTrackWamPlugin(this.trackId, url, initialState);
  }

  /**
   * Compile Faust DSP source in the browser (via the optional @dawcore/faust
   * peer) and add the resulting WAM to this track's chain. Compile errors
   * keep their Faust line/column diagnostics and leave the chain untouched.
   */
  addFaustEffect(dspCode: string, options?: { name?: string }): Promise<string> {
    return this._effectsEditor().addTrackFaustEffect(this.trackId, dspCode, options);
  }

  /** Snapshot this track's chain in its persisted form (see dawcore README). */
  getEffectsState(): Promise<SerializedEffectEntry[]> {
    const editor = this.closest('daw-editor') as TrackEffectsDelegate | null;
    return editor?.getTrackEffectsState(this.trackId) ?? Promise.resolve([]);
  }

  /** Replace this track's chain with a persisted snapshot. */
  setEffectsState(entries: SerializedEffectEntry[]): Promise<void> {
    return this._effectsEditor().setTrackEffectsState(this.trackId, entries);
  }

  /**
   * Open (lazily creating) the GUI for one of this track's effects into a
   * consumer-provided container. Closing hides without interrupting audio;
   * the element is cached for reopen. See <daw-editor>.openEffectGui.
   */
  openEffectGui(effectId: string, container: HTMLElement): Promise<HTMLElement> {
    return this._effectsEditor().openTrackEffectGui(this.trackId, effectId, container);
  }

  /** Hide an effect's GUI (cached for reopen — never destroys). */
  closeEffectGui(effectId: string): void {
    this._effectsEditor().closeTrackEffectGui(this.trackId, effectId);
  }

  removeEffect(effectId: string): void {
    this._effectsEditor().removeTrackEffect(this.trackId, effectId);
  }

  setEffectParams(effectId: string, params: Record<string, number>): void {
    this._effectsEditor().setTrackEffectParams(this.trackId, effectId, params);
  }

  setEffectBypassed(effectId: string, bypassed: boolean): void {
    this._effectsEditor().setTrackEffectBypassed(this.trackId, effectId, bypassed);
  }

  moveEffect(effectId: string, newIndex: number): void {
    this._effectsEditor().moveTrackEffect(this.trackId, effectId, newIndex);
  }

  get effects(): TrackEffectState[] {
    const editor = this.closest('daw-editor') as TrackEffectsDelegate | null;
    return editor?.trackEffects(this.trackId) ?? [];
  }

  private _effectsEditor(): TrackEffectsDelegate {
    const editor = this.closest('daw-editor') as TrackEffectsDelegate | null;
    if (!editor) {
      throw new Error(
        '[waveform-playlist] <daw-track> effects API requires the track to be inside a <daw-editor>'
      );
    }
    return editor;
  }

  /**
   * A move with `Node.moveBefore()` (#848; modern-web-guidance
   * `custom-elements`): the browser calls this instead of
   * `disconnectedCallback` → `connectedCallback`, so the element stays
   * registered and sends no connected event again. The editor's
   * MutationObserver still sees the move and reads the new position.
   */
  connectedMoveCallback(): void {}

  connectedCallback() {
    super.connectedCallback();
    // Defer so the editor's connectedCallback (which registers the
    // daw-track-connected listener) has time to run. Without this,
    // tracks parsed before the editor would fire events with no listener.
    setTimeout(() => {
      this.dispatchEvent(
        new CustomEvent('daw-track-connected', {
          bubbles: true,
          composed: true,
          detail: { trackId: this.trackId, element: this },
        })
      );
    }, 0);
  }

  // Track removal is detected by the editor's MutationObserver,
  // not by dispatching from disconnectedCallback (detached elements
  // cannot bubble events to ancestors).

  private _hasRendered = false;

  updated(changed: PropertyValues) {
    // Skip the initial render — all properties appear in `changed` on first
    // update, but the editor handles initial state via daw-track-connected.
    if (!this._hasRendered) {
      this._hasRendered = true;
      return;
    }

    // The names go in the event (#843): the editor sends a mixer property
    // only when it is one of them, so an unrelated change (a rename after an
    // Undo) never writes the element's older volume back.
    const trackChanged = TRACK_PROPS.filter((p) => changed.has(p as keyof this));

    if (trackChanged.length > 0) {
      const detail: DawTrackUpdateDetail = { trackId: this.trackId, changed: trackChanged };
      this.dispatchEvent(
        new CustomEvent('daw-track-update', {
          bubbles: true,
          composed: true,
          detail,
        })
      );
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-track': DawTrackElement;
  }
}
