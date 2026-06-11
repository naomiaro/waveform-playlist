import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import type { RenderMode, SpectrogramConfig } from '@waveform-playlist/core';
import type { EffectState as TrackEffectState, SerializedEffectEntry } from '../effects/types';

/** Structural view of the editor's dawcore-internal track-effects contract —
 *  avoids a value-import cycle between daw-track and daw-editor. */
interface TrackEffectsDelegate {
  _trackAddEffect(
    trackId: string,
    target: EventTarget,
    type: string,
    params?: Record<string, number>
  ): string;
  _trackEffectOp(
    trackId: string,
    target: EventTarget,
    op: 'remove' | 'setParams' | 'setBypassed' | 'move',
    effectId: string,
    arg?: unknown
  ): void;
  _trackEffects(trackId: string): TrackEffectState[];
  _trackAddWamPlugin(
    trackId: string,
    target: EventTarget,
    url: string,
    initialState?: unknown
  ): Promise<string>;
  _trackGetEffectsState(trackId: string): Promise<SerializedEffectEntry[]>;
  _trackSetEffectsState(
    trackId: string,
    target: EventTarget,
    entries: SerializedEffectEntry[]
  ): Promise<void>;
}

@customElement('daw-track')
export class DawTrackElement extends LitElement {
  @property() src = '';
  @property() name = '';
  @property({ type: Number }) volume = 1;
  @property({ type: Number }) pan = 0;
  @property({ type: Boolean }) muted = false;
  @property({ type: Boolean }) soloed = false;

  // Custom getter/setter so we can warn-and-fallback on 'both' (dawcore
  // doesn't yet support rendering waveform + spectrogram simultaneously).
  @property({ attribute: 'render-mode', noAccessor: true })
  get renderMode(): RenderMode {
    return this._renderMode;
  }
  set renderMode(value: RenderMode) {
    const old = this._renderMode;
    let next = value;
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
    return this._effectsEditor()._trackAddEffect(this.trackId, this, type, params);
  }

  /** Load a WAM plugin (via the optional @dawcore/wam peer) into this track's chain. */
  addWamPlugin(url: string, initialState?: unknown): Promise<string> {
    return this._effectsEditor()._trackAddWamPlugin(this.trackId, this, url, initialState);
  }

  /** Snapshot this track's chain in its persisted form (see dawcore README). */
  getEffectsState(): Promise<SerializedEffectEntry[]> {
    const editor = this.closest('daw-editor') as TrackEffectsDelegate | null;
    return editor?._trackGetEffectsState(this.trackId) ?? Promise.resolve([]);
  }

  /** Replace this track's chain with a persisted snapshot. */
  setEffectsState(entries: SerializedEffectEntry[]): Promise<void> {
    return this._effectsEditor()._trackSetEffectsState(this.trackId, this, entries);
  }

  removeEffect(effectId: string): void {
    this._effectsEditor()._trackEffectOp(this.trackId, this, 'remove', effectId);
  }

  setEffectParams(effectId: string, params: Record<string, number>): void {
    this._effectsEditor()._trackEffectOp(this.trackId, this, 'setParams', effectId, params);
  }

  setEffectBypassed(effectId: string, bypassed: boolean): void {
    this._effectsEditor()._trackEffectOp(this.trackId, this, 'setBypassed', effectId, bypassed);
  }

  moveEffect(effectId: string, newIndex: number): void {
    this._effectsEditor()._trackEffectOp(this.trackId, this, 'move', effectId, newIndex);
  }

  get effects(): TrackEffectState[] {
    const editor = this.closest('daw-editor') as TrackEffectsDelegate | null;
    return editor?._trackEffects(this.trackId) ?? [];
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

    const trackProps = [
      'volume',
      'pan',
      'muted',
      'soloed',
      'src',
      'name',
      'renderMode',
      'spectrogramConfig',
    ];
    const hasTrackChange = trackProps.some((p) => changed.has(p as keyof this));

    if (hasTrackChange) {
      this.dispatchEvent(
        new CustomEvent('daw-track-update', {
          bubbles: true,
          composed: true,
          detail: { trackId: this.trackId },
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
