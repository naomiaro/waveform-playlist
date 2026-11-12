import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { DragDropProvider } from '@dnd-kit/react';
import { RestrictToHorizontalAxis } from '@dnd-kit/abstract/modifiers';
import { getGlobalAudioContext } from '@waveform-playlist/playout';
import { createTrack, createClipFromSeconds, type ClipTrack } from '@waveform-playlist/core';
import {
  WaveformPlaylistProvider,
  ClipInteractionOptions,
  ClipCollisionModifier,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  AudioPosition,
  useClipDragHandlers,
  useDragSensors,
  usePlaylistControls,
  usePlaylistZoom,
  usePlaybackRefs,
} from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

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

const AUDIO = '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/';

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

async function loadTracks(): Promise<ClipTrack[]> {
  const audioContext = getGlobalAudioContext();
  const buffers = new Map<string, AudioBuffer>();
  await Promise.all(
    audioFiles.map(async (file) => {
      const response = await fetch(file.src);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${file.src}: ${response.statusText}`);
      }
      buffers.set(file.id, await audioContext.decodeAudioData(await response.arrayBuffer()));
    })
  );
  return trackConfigs.map((config) =>
    createTrack({
      name: config.name,
      clips: config.clips.map((clip) =>
        createClipFromSeconds({
          audioBuffer: buffers.get(clip.fileId)!,
          startTime: clip.startTime,
          duration: clip.duration,
          offset: clip.offset,
          name: `${config.name} ${clip.offset}-${clip.offset + clip.duration}s`,
        })
      ),
    })
  );
}

interface ClipDragSetupProps {
  tracks: ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
  touchOptimized: boolean;
  children: React.ReactNode;
}

/**
 * The part an app writes when it does not use `ClipInteractionProvider`: its
 * own `DragDropProvider`, with the library's sensors, drag handlers and
 * collision modifier.
 */
function ClipDragSetup({ tracks, onTracksChange, touchOptimized, children }: ClipDragSetupProps) {
  const { samplesPerPixel } = usePlaylistZoom();
  const { playoutRef, isDraggingRef } = usePlaybackRefs();
  const { setSelectedTrackId } = usePlaylistControls();

  // With touchOptimized, a touch has to hold for 250ms before a drag starts,
  // so a swipe still scrolls. Mouse and pen are unaffected.
  const sensors = useDragSensors({ touchOptimized });

  const {
    onDragStart: handleDragStart,
    onDragMove,
    onDragEnd,
  } = useClipDragHandlers({
    tracks,
    onTracksChange,
    samplesPerPixel,
    engineRef: playoutRef,
    isDraggingRef,
  });

  // Select the track of the clip that is being dragged.
  const onDragStart: typeof handleDragStart = (event) => {
    const trackIndex = event.operation?.source?.data?.trackIndex as number | undefined;
    if (trackIndex !== undefined && tracks[trackIndex]) {
      setSelectedTrackId(tracks[trackIndex].id);
    }
    handleDragStart(event);
  };

  // The collision modifier takes a function for `tracks`, so the modifiers
  // array is not rebuilt on every pointer move of a trim (tracks change then).
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
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [interactive, setInteractive] = useState(true);
  const [touchOptimized, setTouchOptimized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadTracks().then(
      (loaded) => {
        if (!cancelled) setTracks(loaded);
      },
      (err) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div style={{ padding: '2rem', color: 'red' }}>Error loading audio: {error.message}</div>
    );
  }

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      sampleRate={48000}
      onTracksChange={setTracks}
      samplesPerPixel={1024}
      mono
      waveHeight={100}
      controls={{ show: true, width: 200 }}
      theme={theme}
      timescale
      barWidth={4}
      barGap={0}
    >
      <Controls>
        <PlayButton />
        <PauseButton />
        <StopButton />
        <AudioPosition />
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

      <ClipDragSetup tracks={tracks} onTracksChange={setTracks} touchOptimized={touchOptimized}>
        {/* The one place the clips learn what they may do. Waveform takes no prop for it. */}
        <ClipInteractionOptions enabled={interactive} touchOptimized={touchOptimized}>
          <Waveform showClipHeaders />
        </ClipInteractionOptions>
      </ClipDragSetup>
    </WaveformPlaylistProvider>
  );
}
