import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import type { MidiNoteData } from '@waveform-playlist/core';

@customElement('daw-clip')
export class DawClipElement extends LitElement {
  @property() src = '';
  @property({ attribute: 'peaks-src' }) peaksSrc = '';
  @property({ type: Number }) start = 0;
  @property({ type: Number }) duration = 0;
  @property({ type: Number }) offset = 0;
  @property({ type: Number }) gain = 1;
  @property() name = '';
  @property() color = '';
  @property({ type: Number, attribute: 'fade-in' }) fadeIn = 0;
  @property({ type: Number, attribute: 'fade-out' }) fadeOut = 0;
  @property({ attribute: 'fade-type' }) fadeType = 'linear';

  /** MIDI notes — JS property only, not reflected (note arrays are too large for attributes). */
  @property({ attribute: false }) midiNotes: MidiNoteData[] | null = null;

  /** MIDI channel (0-indexed). Channel 9 = GM percussion. */
  @property({ type: Number, attribute: 'midi-channel', noAccessor: true })
  get midiChannel(): number | null {
    return this._midiChannel;
  }
  set midiChannel(value: number | null) {
    const old = this._midiChannel;
    if (value === null) {
      this._midiChannel = null;
      this.requestUpdate('midiChannel', old);
      return;
    }
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value > 15) {
      console.warn('[dawcore] daw-clip midi-channel ' + value + ' is out of range 0-15 — ignored');
      return;
    }
    this._midiChannel = value;
    this.requestUpdate('midiChannel', old);
  }
  private _midiChannel: number | null = null;

  /** MIDI program (GM instrument 0-127). Used by SoundFontToneTrack. */
  @property({ type: Number, attribute: 'midi-program', noAccessor: true })
  get midiProgram(): number | null {
    return this._midiProgram;
  }
  set midiProgram(value: number | null) {
    const old = this._midiProgram;
    if (value === null) {
      this._midiProgram = null;
      this.requestUpdate('midiProgram', old);
      return;
    }
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value > 127) {
      console.warn('[dawcore] daw-clip midi-program ' + value + ' is out of range 0-127 — ignored');
      return;
    }
    this._midiProgram = value;
    this.requestUpdate('midiProgram', old);
  }
  private _midiProgram: number | null = null;

  readonly clipId = crypto.randomUUID();

  // Light DOM — no visual rendering, just a data container
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    // Defer dispatch so:
    //  1. The editor's connectedCallback (which registers the daw-clip-connected
    //     listener) has time to run when parsed all-at-once.
    //  2. The parent's deferred daw-track-connected event fires first; the editor
    //     reads <daw-clip> children synchronously via _readTrackDescriptor, so
    //     this event is the canonical late-append signal.
    // _onClipConnected skips this event during the parent track's initial load
    // (parent not yet in _engineTracks) and runs an incremental load otherwise.
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
