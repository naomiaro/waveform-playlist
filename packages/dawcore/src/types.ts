import type {
  FadeType,
  MidiNoteData,
  RenderMode,
  SpectrogramConfig,
  TrackKind,
} from '@waveform-playlist/core';

// Re-export RenderMode from core as TrackRenderMode for backward compatibility
// during the migration; consumers should prefer RenderMode directly.
export type { RenderMode } from '@waveform-playlist/core';
export type TrackRenderMode = RenderMode;

export interface TrackDescriptor {
  name: string;
  src: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  /** What the track holds: audio clips or MIDI clips, never both (#756). */
  kind: TrackKind;
  /** How an audio track is drawn. A MIDI track is drawn as a piano roll from
   *  its `kind`; its `renderMode` is always `'waveform'` and means nothing. */
  renderMode: TrackRenderMode;
  spectrogramConfig?: SpectrogramConfig | null;
  clips: ClipDescriptor[];
}

/**
 * A render mode from untyped input (an attribute string, a config object from
 * JavaScript). A missing value is `'waveform'`. Anything that is not a render
 * mode is `'waveform'` with a warning; the former `'piano-roll'` gets a hint.
 */
export function normalizeRenderMode(value: unknown): TrackRenderMode {
  if (value === null || value === undefined) return 'waveform';
  if (value === 'waveform' || value === 'spectrogram' || value === 'both') return value;
  console.warn(
    '[dawcore] render-mode="' +
      String(value) +
      '" is not a render mode (waveform or spectrogram); using waveform.' +
      (value === 'piano-roll'
        ? ' A piano roll is how a MIDI track is drawn: set kind="midi" on the track.'
        : '')
  );
  return 'waveform';
}

/**
 * The render mode a track descriptor carries, given its kind. Render modes are
 * for audio tracks; a MIDI track always carries `'waveform'`, so that a
 * `render-mode="spectrogram"` left on it does not start the spectrogram
 * pipeline for a track with no audio.
 */
export function trackDescriptorRenderMode(
  kind: TrackKind,
  requested: TrackRenderMode
): TrackRenderMode {
  return kind === 'midi' ? 'waveform' : requested;
}

/** A `TrackDescriptor` plus its `trackId` — the shape returned by `editor.tracks`
 *  so consumers can map a track's name to the `trackId` the per-track APIs
 *  (`addTrackEffect`, `removeTrack`, `updateTrack`, …) are keyed by. */
export type TrackWithId = TrackDescriptor & { trackId: string };

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
 * `<daw-track src>` shorthand fallback, or recording-clip insertion. There
 * is no DOM element to align with; the engine generates its own id at
 * clip-creation time.
 *
 * `clipId` is that engine clip id when the editor knows it at descriptor
 * creation — currently recorded takes (#659). Pass it to
 * `editor.updateClip()` / `removeClip()` to address the clip.
 */
export interface DropClipDescriptor extends BaseClipDescriptor {
  kind: 'drop';
  clipId?: string;
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
  /**
   * What the track holds. Default `'audio'`, or `'midi'` when `midi` is given.
   * Every clip must be of this kind: a clip of the other kind is not added and
   * is reported through `daw-clip-error`. Creation-only: ignored by `updateTrack`.
   */
  kind?: TrackKind;
  /** How an audio track is drawn. Ignored for a MIDI track (a piano roll). */
  renderMode?: TrackRenderMode;
  spectrogramConfig?: SpectrogramConfig | null;
  clips?: ClipConfig[];
  /**
   * Convenience: makes the track a MIDI track (`kind: 'midi'`) with a single
   * `<daw-clip>` child holding these notes. Equivalent to passing
   * `{ kind: 'midi', clips: [{ midiNotes, midiChannel, midiProgram }] }`.
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
