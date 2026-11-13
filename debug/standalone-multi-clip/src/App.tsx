import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { getGlobalAudioContext } from '@waveform-playlist/playout';
import { createTrack, createClipFromSeconds, type ClipTrack } from '@waveform-playlist/core';
import {
  WaveformPlaylistProvider,
  ClipInteractionProvider,
  PlayButton,
  PauseButton,
  StopButton,
  WaveformRoot,
  WaveformTimescale,
  WaveformLoopRegion,
  WaveformTrackControls,
  WaveformTracks,
  WaveformSelection,
  WaveformPlayhead,
  WaveformClipHeaders,
  WaveformViewOptions,
} from '@waveform-playlist/browser';

const Controls = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const AUDIO_BASE = '/media/audio/AlbertKader_Ubiquitous';

const audioFiles = [
  { id: 'kick', src: `${AUDIO_BASE}/01_Kick.opus` },
  { id: 'hihat', src: `${AUDIO_BASE}/02_HiHat1.opus` },
  { id: 'claps', src: `${AUDIO_BASE}/04_Claps.opus` },
  { id: 'bass', src: `${AUDIO_BASE}/08_Bass.opus` },
  { id: 'synth', src: `${AUDIO_BASE}/09_Synth1_Unmodulated.opus` },
];

const trackConfigs = [
  {
    name: 'Kick',
    clips: [
      { fileId: 'kick', startTime: 0, duration: 8, offset: 0 },
      { fileId: 'kick', startTime: 12, duration: 8, offset: 8 },
    ],
  },
  {
    name: 'HiHat',
    clips: [
      { fileId: 'hihat', startTime: 4, duration: 12, offset: 4 },
    ],
  },
  {
    name: 'Claps',
    clips: [
      { fileId: 'claps', startTime: 8, duration: 4, offset: 0 },
      { fileId: 'claps', startTime: 16, duration: 4, offset: 4 },
    ],
  },
  {
    name: 'Bass',
    clips: [
      { fileId: 'bass', startTime: 0, duration: 20, offset: 0 },
    ],
  },
  {
    name: 'Synth',
    clips: [
      { fileId: 'synth', startTime: 4, duration: 8, offset: 2 },
      { fileId: 'synth', startTime: 14, duration: 6, offset: 10 },
    ],
  },
];

export function App() {
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const audioContext = getGlobalAudioContext();
    const fileBuffers = new Map<string, AudioBuffer>();

    audioFiles.forEach(async (file) => {
      try {
        const response = await fetch(file.src);
        if (!response.ok) throw new Error(`${response.status} ${file.src}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        if (cancelled) return;
        fileBuffers.set(file.id, audioBuffer);
        setLoadedCount((prev) => prev + 1);

        // Build tracks from configs that have all files loaded
        const newTracks: ClipTrack[] = [];
        for (const cfg of trackConfigs) {
          const ids = [...new Set(cfg.clips.map((c) => c.fileId))];
          if (ids.every((id) => fileBuffers.has(id))) {
            newTracks.push(
              createTrack({
                name: cfg.name,
                clips: cfg.clips.map((c) =>
                  createClipFromSeconds({
                    audioBuffer: fileBuffers.get(c.fileId)!,
                    startTime: c.startTime,
                    duration: c.duration,
                    offset: c.offset,
                    name: `${cfg.name} ${c.offset}–${c.offset + c.duration}s`,
                  }),
                ),
              }),
            );
          }
        }
        setTracks(newTracks);
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    });

    return () => { cancelled = true; };
  }, []);

  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;

  return (
    <>
      <h1>Standalone Multi-Clip Test</h1>
      <p className="note">
        @waveform-playlist/browser from npm (not workspace). React 19.
        Drag clips to verify horizontal constraint (#317).
        {loadedCount < audioFiles.length && ` Loading ${loadedCount}/${audioFiles.length}...`}
      </p>
      <WaveformPlaylistProvider
        tracks={tracks}
        onTracksChange={setTracks}
        samplesPerPixel={1024}
        mono
      >
        <ClipInteractionProvider>
          <Controls>
            <PlayButton />
            <PauseButton />
            <StopButton />
          </Controls>
          <WaveformViewOptions waveHeight={80}>
            <WaveformRoot>
              <WaveformTimescale />
              <WaveformLoopRegion />
              <WaveformTrackControls width={180} />
              <WaveformTracks>
                <WaveformClipHeaders />
              </WaveformTracks>
              <WaveformSelection />
              <WaveformPlayhead />
            </WaveformRoot>
          </WaveformViewOptions>
        </ClipInteractionProvider>
      </WaveformPlaylistProvider>
    </>
  );
}
