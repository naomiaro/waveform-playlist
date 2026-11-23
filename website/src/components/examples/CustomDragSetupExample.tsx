import { sitePath } from '../../utils/sitePath';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { DragDropProvider } from '@dnd-kit/react';
import { RestrictToHorizontalAxis } from '@dnd-kit/abstract/modifiers';
import { createTrack, type ArrangementTrack, type LoadingClip } from '@waveform-playlist/core';
import {
  WaveformPlaylistProvider,
  ClipInteractionOptions,
  ClipCollisionModifier,
  PlayButton,
  PauseButton,
  StopButton,
  AudioPosition,
  useClipDragHandlers,
  useDragSensors,
  useEditorControls,
  usePlaylistZoom,
  usePlaylistTimeline,
  useCreateArrangement,
  WaveformEditor,
  WaveformViewOptions,
} from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { SourceLoadError } from './SourceLoadError';

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
  align-items: center;
`;

const Option = styled.label`
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 0.875rem;
  cursor: pointer;
`;

const AUDIO = sitePath('/media/audio/AlbertKader_Ubiquitous/');

const audioFiles = [
  { id: 'kick', src: AUDIO + '01_Kick.opus' },
  { id: 'claps', src: AUDIO + '04_Claps.opus' },
  { id: 'bass', src: AUDIO + '08_Bass.opus' },
];

const trackConfigs = [
  {
    name: 'Kick',
    clips: [
      { fileId: 'kick', startTime: 0, duration: 6, offset: 0 },
      { fileId: 'kick', startTime: 10, duration: 6, offset: 6 },
    ],
  },
  {
    name: 'Claps',
    clips: [
      { fileId: 'claps', startTime: 4, duration: 4, offset: 0 },
      { fileId: 'claps', startTime: 12, duration: 4, offset: 4 },
    ],
  },
  {
    name: 'Bass',
    clips: [{ fileId: 'bass', startTime: 2, duration: 12, offset: 0 }],
  },
];

const fileSrc = (fileId: string): string => {
  const file = audioFiles.find((f) => f.id === fileId);
  if (!file) throw new Error(`Audio file not found for ID: ${fileId}`);
  return file.src;
};

// Each clip is a loading clip in seconds that names its file: the arrangement
// fetches each file once, the waveform draws a placeholder until it has
// decoded, and the page is ready when every file has.
const buildTracks = (): ArrangementTrack[] =>
  trackConfigs.map((config) => ({
    ...createTrack({ name: config.name, clips: [] }),
    clips: config.clips.map(
      (clip, index): LoadingClip => ({
        id: `${clip.fileId}-${index}`,
        src: fileSrc(clip.fileId),
        start: clip.startTime,
        duration: clip.duration,
        offset: clip.offset,
        name: `${config.name} ${clip.offset}-${clip.offset + clip.duration}s`,
      })
    ),
  }));

interface ClipDragSetupProps {
  touchOptimized: boolean;
  children: React.ReactNode;
}

/**
 * The part an app writes when it does not use `ClipInteractionProvider`: its
 * own `DragDropProvider`, with the library's sensors, drag handlers and
 * collision modifier.
 */
function ClipDragSetup({ touchOptimized, children }: ClipDragSetupProps) {
  const { samplesPerPixel } = usePlaylistZoom();
  // The arrangement's tracks with their loaded clips: what a drag moves and
  // collides with, in the order of the rows (the handlers read the
  // arrangement themselves)
  const { tracks } = usePlaylistTimeline();
  const { setSelectedTrackId } = useEditorControls();

  // With touchOptimized, a touch has to hold for 250ms before a drag starts,
  // so a swipe still scrolls. Mouse and pen are unaffected.
  const sensors = useDragSensors({ touchOptimized });

  const {
    onDragStart: handleDragStart,
    onDragMove,
    onDragEnd,
  } = useClipDragHandlers({ samplesPerPixel });

  // Select the track of the clip that is being dragged.
  const onDragStart: typeof handleDragStart = (event) => {
    const trackIndex = event.operation?.source?.data?.trackIndex as number | undefined;
    if (trackIndex !== undefined && tracks[trackIndex]) {
      setSelectedTrackId(tracks[trackIndex].id);
    }
    handleDragStart(event);
  };

  // The collision modifier takes a function for `tracks`, so the modifiers
  // array is not rebuilt when the tracks change (a move or a trim, once each
  // on release).
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const getTracks = useCallback(() => tracksRef.current, []);
  const modifiers = useMemo(
    () => [
      RestrictToHorizontalAxis,
      ClipCollisionModifier.configure({ tracks: getTracks, samplesPerPixel }),
    ],
    [getTracks, samplesPerPixel]
  );

  return (
    <DragDropProvider
      sensors={sensors}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      modifiers={modifiers}
    >
      {children}
    </DragDropProvider>
  );
}

export function CustomDragSetupExample() {
  const { theme } = useDocusaurusTheme();
  // The arrangement owns the tracks and loads their audio
  const arrangement = useCreateArrangement(buildTracks);
  const [interactive, setInteractive] = useState(true);
  const [touchOptimized, setTouchOptimized] = useState(false);

  return (
    <WaveformPlaylistProvider
      arrangement={arrangement}
      sampleRate={48000}
      samplesPerPixel={1024}
      mono
      theme={theme}
    >
      <Controls>
        <PlayButton />
        <PauseButton />
        <StopButton />
        <AudioPosition />
        <SourceLoadError arrangement={arrangement} />
        <Option>
          <input
            type="checkbox"
            checked={interactive}
            onChange={(e) => setInteractive(e.target.checked)}
          />
          Clips can be dragged and trimmed
        </Option>
        <Option>
          <input
            type="checkbox"
            checked={touchOptimized}
            onChange={(e) => setTouchOptimized(e.target.checked)}
          />
          Touch-optimized (hold to drag, wide trim handles)
        </Option>
      </Controls>

      <ClipDragSetup touchOptimized={touchOptimized}>
        {/* The one place the clips learn what they may do. Waveform takes no prop for it. */}
        <ClipInteractionOptions enabled={interactive} touchOptimized={touchOptimized}>
          <WaveformViewOptions waveHeight={100} barWidth={4} barGap={0}>
            <WaveformEditor />
          </WaveformViewOptions>
        </ClipInteractionOptions>
      </ClipDragSetup>
    </WaveformPlaylistProvider>
  );
}
