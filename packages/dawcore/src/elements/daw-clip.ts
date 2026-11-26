import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import type { MidiNoteData } from '@waveform-playlist/core';
import {
  detachedWarning,
  linkHostOf,
  setCustomState,
  type ClipLinkValues,
} from '../interactions/element-links';

@customElement('daw-clip')
export class DawClipElement extends LitElement {
  @property() src = '';
  @property({ attribute: 'peaks-src' }) peaksSrc = '';
  // --- Live properties (#848): the arrangement's values while the clip is in
  // it; the declaration (attributes, a set before entry) otherwise. Setting
  // one is a request to the arrangement (an undo step) and never writes the
  // attribute. ---

  /** Timeline position in seconds. */
  @property({ type: Number, noAccessor: true })
  get start(): number {
    return this._linked('start');
  }
  set start(value: number) {
    this._request('start', value);
  }
  @property({ type: Number, noAccessor: true })
  get duration(): number {
    return this._linked('duration');
  }
  set duration(value: number) {
    this._request('duration', value);
  }
  @property({ type: Number, noAccessor: true })
  get offset(): number {
    return this._linked('offset');
  }
  set offset(value: number) {
    this._request('offset', value);
  }
  @property({ type: Number, noAccessor: true })
  get gain(): number {
    return this._linked('gain');
  }
  set gain(value: number) {
    this._request('gain', value);
  }
  @property({ noAccessor: true })
  get name(): string {
    return this._linked('name');
  }
  set name(value: string) {
    this._request('name', value ?? '');
  }
  @property() color = '';
  @property({ type: Number, attribute: 'fade-in' }) fadeIn = 0;
  @property({ type: Number, attribute: 'fade-out' }) fadeOut = 0;
  @property({ attribute: 'fade-type' }) fadeType = 'linear';

  /** MIDI notes — JS property only, not reflected (note arrays are too large for attributes). */
  @property({ attribute: false, noAccessor: true })
  get midiNotes(): MidiNoteData[] | null {
    return this._linked('midiNotes');
  }
  set midiNotes(value: MidiNoteData[] | null) {
    this._request('midiNotes', value ?? null);
  }

  /** MIDI channel (0-indexed). Channel 9 = GM percussion. */
  @property({ type: Number, attribute: 'midi-channel', noAccessor: true })
  get midiChannel(): number | null {
    return this._linked('midiChannel');
  }
  set midiChannel(value: number | null) {
    if (
      value !== null &&
      (!Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value > 15)
    ) {
      console.warn('[dawcore] daw-clip midi-channel ' + value + ' is out of range 0-15 — ignored');
      return;
    }
    this._request('midiChannel', value);
  }

  /** MIDI program (GM instrument 0-127). Used by SoundFontToneTrack. */
  @property({ type: Number, attribute: 'midi-program', noAccessor: true })
  get midiProgram(): number | null {
    return this._linked('midiProgram');
  }
  set midiProgram(value: number | null) {
    if (
      value !== null &&
      (!Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value > 127)
    ) {
      console.warn('[dawcore] daw-clip midi-program ' + value + ' is out of range 0-127 — ignored');
      return;
    }
    this._request('midiProgram', value);
  }

  /** What the page declared: the attributes, and a property set before the clip entered. */
  private _declared: ClipLinkValues = {
    start: 0,
    duration: 0,
    offset: 0,
    gain: 1,
    name: '',
    midiNotes: null,
    midiChannel: null,
    midiProgram: null,
  };
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

  private get _trackId(): string {
    return (this.closest('daw-track') as { trackId?: string } | null)?.trackId ?? '';
  }

  private _linked<K extends keyof ClipLinkValues>(key: K): ClipLinkValues[K] {
    const host = linkHostOf(this);
    const trackId = this._trackId;
    const live =
      host && trackId && host._clipLinkState(trackId, this.clipId) === 'live'
        ? host._clipValues(trackId, this.clipId)
        : null;
    return live ? live[key] : this._declared[key];
  }

  private _request<K extends keyof ClipLinkValues>(key: K, value: ClipLinkValues[K]): void {
    const old = this._linked(key);
    const host = linkHostOf(this);
    const trackId = this._trackId;
    const state = host && trackId ? host._clipLinkState(trackId, this.clipId) : 'pending';
    if (this._fromAttribute || state === 'pending') {
      this._declared = { ...this._declared, [key]: value };
    }
    if (state === 'live') {
      host!._requestClipChange(trackId, this.clipId, { [key]: value } as Partial<ClipLinkValues>);
    } else if (state === 'detached') {
      const label = '<daw-clip> of track "' + trackId + '"';
      console.warn(detachedWarning(label, key + ' = ' + String(value), host!._detachedReason()));
    }
    this.requestUpdate(key, old);
  }

  /** @internal Shown as `:state(detached)` (#848). */
  _setDetached(detached: boolean): void {
    setCustomState(this._internals, 'detached', detached);
  }

  readonly clipId = crypto.randomUUID();

  // Light DOM — no visual rendering, just a data container
  createRenderRoot() {
    return this;
  }

  /**
   * A move with `Node.moveBefore()` (#848; modern-web-guidance
   * `custom-elements`): the browser calls this instead of
   * `disconnectedCallback` → `connectedCallback`, so the element stays
   * connected, and Lit's disconnect and connect do not run. It announces
   * itself again, as a connect does, so the editor sees its new place: a
   * clip in another track, a track back in an editor (#848; a real-Chromium
   * check found both missed with an empty hook).
   */
  connectedMoveCallback(): void {
    this._announceConnected();
  }

  connectedCallback() {
    super.connectedCallback();
    this._announceConnected();
  }

  /** Tell the editor this element is here (a connect or a moveBefore() move). */
  private _announceConnected(): void {
    // Defer dispatch so:
    //  1. The editor's connectedCallback (which registers the daw-clip-connected
    //     listener) has time to run when parsed all-at-once.
    //  2. The parent's deferred daw-track-connected event fires first; the
    //     editor reads the <daw-clip> children when the track enters, so this
    //     event is the late-append signal (and, from connectedMoveCallback,
    //     the signal of a move into another track).
    // _onClipConnected adds the clip to the descriptor of a track that has not
    // entered the arrangement yet, and appends it to an entered track as a
    // loading clip (a loaded one for MIDI) (#848).
    setTimeout(() => {
      this.dispatchEvent(
        new CustomEvent('daw-clip-connected', {
          bubbles: true,
          composed: true,
          detail: { clipId: this.clipId, element: this },
        })
      );
    }, 0);
  }

  // Removal is detected by the editor's MutationObserver — detached elements
  // cannot bubble events to ancestors.

  private _hasRendered = false;

  updated(changed: PropertyValues) {
    if (!this._hasRendered) {
      this._hasRendered = true;
      return;
    }
    const clipProps = [
      'src',
      'peaksSrc',
      'start',
      'duration',
      'offset',
      'gain',
      'name',
      'fadeIn',
      'fadeOut',
      'fadeType',
      'midiNotes',
      'midiChannel',
      'midiProgram',
    ];
    if (clipProps.some((p) => changed.has(p as keyof this))) {
      // Resolve parent <daw-track> at dispatch time so consumers don't need
      // to walk closest('daw-track') themselves. trackId may be empty if the
      // clip is mounted outside a track (developer error).
      const trackEl = this.closest('daw-track') as { trackId?: string } | null;
      this.dispatchEvent(
        new CustomEvent('daw-clip-update', {
          bubbles: true,
          composed: true,
          detail: { trackId: trackEl?.trackId ?? '', clipId: this.clipId },
        })
      );
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-clip': DawClipElement;
  }
}
