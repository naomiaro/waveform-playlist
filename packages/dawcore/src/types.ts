import type { FadeType, MidiNoteData } from '@waveform-playlist/core';

export type TrackRenderMode = 'waveform' | 'piano-roll';

export interface TrackDescriptor {
  name: string;
  src: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  renderMode: TrackRenderMode;
  clips: ClipDescriptor[];
}

/**
 * Common fields shared by all clip descriptors regardless of source.
 */
interface BaseClipDescriptor {
  src: string;
  peaksSrc: string;
  start: number;
  duration: number;
  offset: number;
  gain: number;
  name: string;
  fadeIn: number;
  fadeOut: number;
  fadeType: FadeType;
  midiNotes: MidiNoteData[] | null;
  midiChannel: number | null;
  midiProgram: number | null;
}

/**
 * A clip descriptor sourced from a `<daw-clip>` DOM element. `clipId` is
 * always set — `<daw-clip>.clipId` is a `crypto.randomUUID()` generated at
 * construction. Engine `clip.id` is aligned with this id in `_loadTrack`
 * and `_loadAndAppendClip` so DOM and engine reference the same clip.
 */
export interface DomClipDescriptor extends BaseClipDescriptor {
  kind: 'dom';
  clipId: string;
}

/**
 * A clip descriptor synthesized from a non-DOM source — file drops, the
 * `<daw-track src>` shorthand fallback, or recording-clip insertion. No
 * `clipId` because there's no DOM element to align with; the engine
 * generates its own id at clip-creation time.
 */
export interface DropClipDescriptor extends BaseClipDescriptor {
  kind: 'drop';
}

export type ClipDescriptor = DomClipDescriptor | DropClipDescriptor;

/**
 * Type predicate for the `'dom'` discriminator. Use to narrow a
 * `ClipDescriptor` to `DomClipDescriptor` (which has `clipId`) without
 * inline `c.kind === 'dom'` repetition.
 */
export function isDomClip(desc: ClipDescriptor): desc is DomClipDescriptor {
  return desc.kind === 'dom';
}

/**
 * Public input shape for `editor.addTrack(config)`. All fields optional —
 * defaults match the declarative `<daw-track>` defaults.
 */
export interface TrackConfig {
  name?: string;
  volume?: number;
  pan?: number;
  muted?: boolean;
  soloed?: boolean;
  renderMode?: TrackRenderMode;
  clips?: ClipConfig[];
  /**
   * Convenience: creates a single piano-roll `<daw-clip>` child with these
   * notes and sets `render-mode="piano-roll"` on the track. Equivalent to
   * passing `{ renderMode: 'piano-roll', clips: [{ midiNotes, midiChannel, midiProgram }] }`.
   * An explicit `renderMode` takes precedence over the inferred `'piano-roll'`.
   *
   * Creation-only — ignored by `updateTrack`. To modify notes after the
   * track is built, use `editor.updateClip(trackId, clipId, { midiNotes })` or
   * mutate the `<daw-clip>` element's `midiNotes` property directly.
   */
  midi?: {
    notes: MidiNoteData[];
    channel?: number;
    program?: number;
  };
}

/**
 * Public input shape for clips passed via `TrackConfig.clips` or
 * `editor.addClip(trackId, config)`. `src` is optional to support MIDI clips
 * with no audio source. Other fields default to the matching `<daw-clip>`
 * attribute defaults.
 */
export interface ClipConfig {
  src?: string;
  peaksSrc?: string;
  start?: number;
  duration?: number;
  offset?: number;
  gain?: number;
  name?: string;
  fadeIn?: number;
  fadeOut?: number;
  fadeType?: FadeType;
  midiNotes?: MidiNoteData[];
  midiChannel?: number;
  midiProgram?: number;
}
