/**
 * How `<daw-track>` and `<daw-clip>` are linked to the arrangement the editor
 * plays (#848 PR 3): by id. An element is
 *
 * - pending: not in an editor, or registered and not entered yet. Its
 *   properties are its own declaration (the attributes, and any property set
 *   before entry, which is the value the track enters with);
 * - live: the arrangement holds its id. Properties read the arrangement, and
 *   setting one (or changing its attribute) is a request to it, one undo step;
 * - detached: the editor took it, and the arrangement no longer holds its id
 *   (an Undo of its arrival, a removal made on the arrangement, a refusal).
 *   Properties read the declaration; a change does nothing, with a warning.
 *   The element carries the custom state `detached` (`:state(detached)`).
 *
 * Attributes are never written by the editor.
 */
import type { MidiNoteData, PanLaw, TrackKind } from '@waveform-playlist/core';

export type LinkState = 'pending' | 'live' | 'detached';

/** The `<daw-track>` properties read from the arrangement while live. */
export interface TrackLinkValues {
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  /** `'auto'` until the track's first decoded audio decides it (#684). */
  panLaw: PanLaw;
  name: string;
}

/** The `<daw-clip>` properties read from the arrangement while live. */
export interface ClipLinkValues {
  start: number;
  duration: number;
  offset: number;
  gain: number;
  name: string;
  midiNotes: MidiNoteData[] | null;
  midiChannel: number | null;
  midiProgram: number | null;
}

/** What the elements ask the editor that holds them. */
export interface ElementLinkHost {
  _trackLinkState(trackId: string): LinkState;
  _clipLinkState(trackId: string, clipId: string): LinkState;
  /** The live values; null when the track is not live. */
  _trackValues(trackId: string): TrackLinkValues | null;
  _clipValues(trackId: string, clipId: string): ClipLinkValues | null;
  _requestTrackChange(trackId: string, partial: Partial<TrackLinkValues>): void;
  _requestClipChange(trackId: string, clipId: string, partial: Partial<ClipLinkValues>): void;
  /** The track's position in the arrangement, -1 when it is not there. */
  _trackIndex(trackId: string): number;
  /** The kind of a track the arrangement holds, null when it holds none. */
  _trackKind(trackId: string): TrackKind | null;
  /** Why an element of this editor is detached, for the warning. */
  _detachedReason(): string;
}

/** The editor an element belongs to, when it is in one that links elements. */
export function linkHostOf(el: Element): ElementLinkHost | null {
  const editor = el.closest('daw-editor') as unknown as Partial<ElementLinkHost> | null;
  return editor && typeof editor._trackLinkState === 'function'
    ? (editor as ElementLinkHost)
    : null;
}

/** An element that can show it is detached. */
export interface DetachableElement {
  _setDetached(detached: boolean): void;
}

/**
 * Set or clear the `detached` state on every registered track element and
 * its clip elements.
 */
export function refreshLinkStates(
  host: ElementLinkHost,
  trackEls: Iterable<[string, Element & DetachableElement]>
): void {
  for (const [trackId, trackEl] of trackEls) {
    trackEl._setDetached(host._trackLinkState(trackId) === 'detached');
    for (const clipEl of trackEl.querySelectorAll('daw-clip')) {
      const clip = clipEl as unknown as Element & DetachableElement & { clipId: string };
      clip._setDetached(host._clipLinkState(trackId, clip.clipId) === 'detached');
    }
  }
}

/** The warning for a change on a detached element. */
export function detachedWarning(element: string, change: string, reason: string): string {
  return (
    '[dawcore] ' +
    element +
    ' is detached (' +
    reason +
    '): ' +
    change +
    ' changes nothing. Remove the element and insert it again to declare a new one.'
  );
}

/** Set a custom state on an element's internals; happy-dom and older browsers have none. */
export function setCustomState(
  internals: ElementInternals | null,
  name: string,
  on: boolean
): void {
  const states = internals?.states as unknown as Set<string> | undefined;
  if (!states) return;
  if (on) states.add(name);
  else states.delete(name);
}
