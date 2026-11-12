import type { AnnotationData } from '@waveform-playlist/core';
import type { AnnotationLookup } from '../utils/annotationLookup';

export interface FollowAnnotationsOptions {
  annotations: readonly AnnotationData[];
  lookup: AnnotationLookup<AnnotationData>;
  /** Playback position of this frame, in seconds. */
  time: number;
  activeId: string | null;
  /**
   * True: the highlight follows the playhead and playback is never cut
   * (continuous play). False: playback ends with the active annotation.
   */
  followOnly: boolean;
  /**
   * Leave the highlight where it is this frame. Only read when `followOnly`
   * is true: a bounded play that reaches its end on this frame stops right
   * after, and the highlight must not move on to the next annotation first.
   */
  holdHighlight: boolean;
  setActiveAnnotationId: (id: string | null) => void;
}

/**
 * The annotation step of a provider's animation loop, once per frame.
 *
 * Returns true when the active annotation has played to its end and playback
 * must stop. What "stop" does (where the cursor goes) is the provider's.
 */
export function followAnnotations({
  annotations,
  lookup,
  time,
  activeId,
  followOnly,
  holdHighlight,
  setActiveAnnotationId,
}: FollowAnnotationsOptions): boolean {
  if (annotations.length === 0) return false;

  const current = lookup.atTime(annotations, time);

  if (followOnly) {
    if (holdHighlight) return false;
    if (current && current.id !== activeId) {
      setActiveAnnotationId(current.id);
    } else if (!current && activeId !== null) {
      // Past the active annotation, in a gap: clear it, keep playing.
      setActiveAnnotationId(null);
    }
    return false;
  }

  if (activeId) {
    const active = lookup.byId(annotations, activeId);
    return active !== undefined && time >= active.end;
  }
  // Nothing active yet: adopt the annotation under the playhead.
  if (current) setActiveAnnotationId(current.id);
  return false;
}
