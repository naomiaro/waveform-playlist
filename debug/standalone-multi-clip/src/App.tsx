import styled from 'styled-components';
import { createTrack, type ArrangementTrack, type LoadingClip } from '@waveform-playlist/core';
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
  useCreateArrangement,
  useArrangementSources,
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

const fileSrc = (fileId: string): string => {
  const file = audioFiles.find((f) => f.id === fileId);
  if (!file) throw new Error(`Audio file not found for ID: ${fileId}`);
  return file.src;
};

// Each clip is a loading clip that names its file; the arrangement decodes
// every file once and makes the clips playable as their files arrive.
const buildTracks = (): ArrangementTrack[] =>
  trackConfigs.map((cfg) => {
    const clips: LoadingClip[] = cfg.clips.map((c, index) => ({
      id: `${c.fileId}-${index}`,
      src: fileSrc(c.fileId),
      start: c.startTime,
      duration: c.duration,
      offset: c.offset,
      name: `${cfg.name} ${c.offset}–${c.offset + c.duration}s`,
    }));
    return { ...createTrack({ name: cfg.name }), clips };
  });

export function App() {
  const arrangement = useCreateArrangement(buildTracks);
  const sources = useArrangementSources(arrangement);
  const failed = [...sources.sources.values()].find((source) => source.status === 'failed');
  const loadedCount = sources.sources.size - sources.pendingCount - sources.failedCount;

  if (failed) {
    return <p style={{ color: 'red' }}>Error: {failed.error?.message ?? 'a file failed to load'}</p>;
  }

  return (
    <>
      <h1>Standalone Multi-Clip Test</h1>
      <p className="note">
        @waveform-playlist/browser from npm (not workspace). React 19.
        Drag clips to verify horizontal constraint (#317).
        {sources.isLoading && ` Loading ${loadedCount}/${sources.sources.size}...`}
      </p>
      <WaveformPlaylistProvider
        arrangement={arrangement}
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
