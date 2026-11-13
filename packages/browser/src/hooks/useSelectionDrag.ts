import { createContext, memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createValueSource, type ValueSource } from '@waveform-playlist/core';
import {
  useIsPlaying,
  usePlaybackControls,
  usePlaylistSettings,
} from '../contexts/playlistContexts';
import { useWindowDrag, clampedOffsetX } from './useWindowDrag';

/** A time range in seconds, `start` before `end`. */
export interface SelectionRange {
  start: number;
  end: number;
}

/**
 * The range being drawn by a drag DURING PLAYBACK, or `null`. It is not the
 * selection yet: it becomes one when the button is released. Published by the
 * view that owns the drag (`useSelectionDrag`) and read by the selection
 * highlight, which shows it in place of the selection while it is set.
 *
 * A source and not state: it changes on every pointer move, and only the
 * highlight should follow it. Internal: not exported from the package.
 */
export const SelectionPreviewContext = createContext<ValueSource<SelectionRange | null> | null>(
  null
);

/** A range shorter than this, in seconds, is a click. */
const MIN_RANGE_SECONDS = 0.1;

export interface UseSelectionDragOptions {
  samplesPerPixel: number;
  sampleRate: number;
  /**
   * Called for every primary-button press, before the drag begins, with the
   * time under the pointer, the pointer's offset from the top of the pressed
   * element, and whether playback is running.
   */
  onPress?: (press: { time: number; offsetY: number; isPlaying: boolean }) => void;
  /** What a click (no drag) does with its time while playback is stopped. */
  onClickWhileStopped: (time: number) => void;
}

export interface SelectionDrag {
  /** True from the press to the release. */
  isSelecting: boolean;
  /** For the `mousedown` of the element the drag starts on (the click overlay). */
  handleMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  /** For `SelectionPreviewContext.Provider`. The same object for the life of the component. */
  preview: ValueSource<SelectionRange | null>;
  /** For `<AutomaticScrollFlag flagRef>`, which the view must render. */
  automaticScrollRef: React.RefObject<boolean>;
}

/**
 * Keeps `flagRef` equal to the provider's automatic-scroll setting. Renders
 * nothing.
 *
 * The drag needs the setting only when an event arrives. Read with
 * `usePlaylistSettings()` in the view itself, a toggle of the setting would
 * render the view's root (in `MediaElementPlaylist`, the whole waveform) for
 * a value it never draws. This component is the one that follows the
 * setting; the view renders it and nothing else changes.
 * A layout effect: only a committed value, and in place before any event that
 * follows the commit. Memoized: its one prop is a ref that never changes, so a
 * render of the view does not render it.
 */
export const AutomaticScrollFlag = memo(function AutomaticScrollFlag({
  flagRef,
}: {
  flagRef: React.RefObject<boolean>;
}) {
  const { isAutomaticScroll } = usePlaylistSettings();
  useLayoutEffect(() => {
    flagRef.current = isAutomaticScroll;
  });
  return null;
});

/**
 * The selection drag of a waveform view, the same under either provider.
 *
 * **While playback is stopped** the selection follows the pointer: the press
 * collapses it at the pressed time, every move sets the ordered range from
 * the press to the pointer, and the release leaves that range (or, for a
 * click, calls `onClickWhileStopped`).
 *
 * **While playback is running nothing is committed before the release.**
 * `setSelection` restarts a running play, so writing the selection on the
 * press and on each move would restart playback under the pointer; until
 * 2026-11 the press did exactly that, moves were ignored, and no range could
 * be drawn during playback. Now the press changes nothing and the release
 * calls `setSelection` once. What the release commits depends on the
 * automatic scroll (maintainer's rules, 2026-11-12):
 *
 * - **Automatic scroll off:** the moves publish the range to `preview` (the
 *   highlight shows it, playback carries on). The release sets that range,
 *   which the provider plays from its start to its end (open-ended under the
 *   multitrack provider with looping on); a range shorter than 0.1 s is not
 *   previewed and is a click: playback moves to where the press landed.
 * - **Automatic scroll on:** no range can be drawn. The view scrolls to keep
 *   the playhead in sight, so the audio moves under a still pointer and the
 *   time under it at the release is not the time at the press. A press and
 *   its release are one seek, to the time captured at the press, however far
 *   the pointer travelled; moves are ignored.
 *
 * The drag is followed on the window (`useWindowDrag`): the pointer may leave
 * the element and the button may be released anywhere; positions outside it
 * clamp to its ends. When the drag ends with no release (the window lost
 * focus, or the `mouseup` was lost), a preview is dropped and playback is untouched; while stopped the
 * selection stays as the last move left it.
 */
export function useSelectionDrag({
  samplesPerPixel,
  sampleRate,
  onPress,
  onClickWhileStopped,
}: UseSelectionDragOptions): SelectionDrag {
  const { isPlaying } = useIsPlaying();
  const { setSelection } = usePlaybackControls();
  const [isSelecting, setIsSelecting] = useState(false);
  // Kept current by <AutomaticScrollFlag>, read only inside the handlers.
  const automaticScrollRef = useRef(false);

  const previewHandle = useMemo(() => createValueSource<SelectionRange | null>(null), []);
  // The time under the pointer where the drag began.
  const pressTimeRef = useRef(0);
  // The element the drag began on, for pointer positions while the pointer is
  // somewhere else.
  const dragElementRef = useRef<HTMLDivElement | null>(null);

  const timeAt = (clientX: number): number | null => {
    const element = dragElementRef.current;
    const x = element ? clampedOffsetX(element, clientX) : null;
    return x === null ? null : (x * samplesPerPixel) / sampleRate;
  };

  /** From where the press landed to `time`, in order. The anchor is the press,
   *  never the selection's start: that stops being the anchor as soon as the
   *  pointer passes to the left of it (#733). */
  const rangeTo = (time: number): SelectionRange => ({
    start: Math.min(pressTimeRef.current, time),
    end: Math.max(pressTimeRef.current, time),
  });

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    // Primary button only: a right-click opens the context menu and its
    // release may never be delivered.
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    // Never before the start of the timeline, whatever the event says.
    const time = Math.max(0, ((event.clientX - rect.left) * samplesPerPixel) / sampleRate);

    onPress?.({ time, offsetY: event.clientY - rect.top, isPlaying });

    pressTimeRef.current = time;
    dragElementRef.current = event.currentTarget;
    setIsSelecting(true);
    if (!isPlaying) setSelection(time, time);
  };

  const handleDragMove = (event: MouseEvent) => {
    if (isPlaying && automaticScrollRef.current) return;
    const moveTime = timeAt(event.clientX);
    if (moveTime === null) return;
    const range = rangeTo(moveTime);

    if (isPlaying) {
      previewHandle.publish(range.end - range.start < MIN_RANGE_SECONDS ? null : range);
      return;
    }

    // Stopped. Also reached when playback stopped (or ended) under a drag
    // that began while it ran: from here it is an ordinary drag.
    previewHandle.publish(null);
    setSelection(range.start, range.end);
  };

  const handleDragEnd = (event: MouseEvent | null) => {
    setIsSelecting(false);
    previewHandle.publish(null);

    // The window lost focus mid-drag: there is no release position.
    if (event === null) return;

    // Where the press landed: what a click during playback seeks to.
    const pressTime = pressTimeRef.current;

    if (isPlaying && automaticScrollRef.current) {
      setSelection(pressTime, pressTime);
      return;
    }

    const endTime = timeAt(event.clientX);
    if (endTime === null) return;
    const range = rangeTo(endTime);
    const isClick = range.end - range.start < MIN_RANGE_SECONDS;

    if (isPlaying) {
      if (isClick) setSelection(pressTime, pressTime);
      else setSelection(range.start, range.end);
      return;
    }

    if (isClick) onClickWhileStopped(range.start);
    else setSelection(range.start, range.end);
  };

  useWindowDrag(isSelecting, handleDragMove, handleDragEnd);

  return { isSelecting, handleMouseDown, preview: previewHandle.source, automaticScrollRef };
}
