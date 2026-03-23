import React from 'react';
import type { KeyboardShortcut } from '../hooks/useKeyboardShortcuts';
import { usePlaybackShortcuts } from '../hooks/usePlaybackShortcuts';
import { useClipSplitting } from '../hooks/useClipSplitting';
import { useAnnotationKeyboardControls } from '../hooks/useAnnotationKeyboardControls';
import { usePlaylistData, usePlaylistState, usePlaylistControls } from '../WaveformPlaylistContext';

export interface KeyboardShortcutsProps {
  /** Enable default playback shortcuts (Space, Escape, 0). Defaults to false. */
  playback?: boolean;
  /** Enable clip splitting shortcut ('s' key). Defaults to false. */
  clipSplitting?: boolean;
  /** Enable annotation keyboard controls (arrow nav, boundary editing). Defaults to false. */
  annotations?: boolean;
  /** Enable undo/redo shortcuts (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z). Defaults to false. */
  undo?: boolean;
  /** Additional shortcuts appended to the defaults. */
  additionalShortcuts?: KeyboardShortcut[];
}

/**
 * Self-closing component that sets up keyboard shortcuts for the playlist.
 * Must be rendered inside a WaveformPlaylistProvider.
 *
 * @example
 * ```tsx
 * <WaveformPlaylistProvider tracks={tracks} {...}>
 *   <KeyboardShortcuts playback clipSplitting />
 *   <Waveform />
 * </WaveformPlaylistProvider>
 * ```
 */
export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({
  playback = false,
  clipSplitting = false,
  annotations = false,
  undo: undoEnabled = false,
  additionalShortcuts = [],
}) => {
  // Clip splitting setup
  const { tracks, samplesPerPixel, playoutRef, duration } = usePlaylistData();
  const {
    annotations: annotationList,
    linkEndpoints,
    activeAnnotationId,
    continuousPlay,
  } = usePlaylistState();
  const { setAnnotations, setActiveAnnotationId, scrollContainerRef, play, undo, redo } =
    usePlaylistControls();

  const { splitClipAtPlayhead } = useClipSplitting({
    tracks,
    samplesPerPixel,
    engineRef: playoutRef,
  });

  // Build additional shortcuts from enabled features
  const allAdditional: KeyboardShortcut[] = [];

  if (clipSplitting) {
    allAdditional.push({
      key: 's',
      action: splitClipAtPlayhead,
      description: 'Split clip at playhead',
      preventDefault: true,
    });
  }

  if (undoEnabled) {
    allAdditional.push(
      { key: 'z', ctrlKey: true, shiftKey: false, action: undo, description: 'Undo' },
      { key: 'z', metaKey: true, shiftKey: false, action: undo, description: 'Undo' },
      { key: 'z', ctrlKey: true, shiftKey: true, action: redo, description: 'Redo' },
      { key: 'z', metaKey: true, shiftKey: true, action: redo, description: 'Redo' }
    );
  }

  if (additionalShortcuts.length > 0) {
    allAdditional.push(...additionalShortcuts);
  }

  // Playback shortcuts (or just additional if playback is off)
  usePlaybackShortcuts({
    enabled: playback || allAdditional.length > 0,
    ...(playback ? { additionalShortcuts: allAdditional } : { shortcuts: allAdditional }),
  });

  // Annotation keyboard controls
  useAnnotationKeyboardControls({
    annotations: annotationList,
    activeAnnotationId,
    onAnnotationsChange: setAnnotations,
    onActiveAnnotationChange: setActiveAnnotationId,
    duration,
    linkEndpoints,
    continuousPlay,
    scrollContainerRef,
    onPlay: play,
    enabled: annotations && annotationList.length > 0,
  });

  return null;
};
