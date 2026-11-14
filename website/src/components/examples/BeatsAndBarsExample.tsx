import React, { useState } from 'react';
import styled from 'styled-components';
import { createTrack, type LoadingClip, type PlaylistTrack } from '@waveform-playlist/core';
import {
  WaveformPlaylistProvider,
  ClipInteractionProvider,
  KeyboardShortcuts,
  PlayButton,
  PauseButton,
  StopButton,
  LoopButton,
  ZoomInButton,
  ZoomOutButton,
  AudioPosition,
  AutomaticScrollCheckbox,
  MasterVolumeControl,
  WaveformEditor,
  WaveformViewOptions,
} from '@waveform-playlist/browser';
import {
  BeatsAndBarsProvider,
  BaseSelectSmall,
  BaseInputSmall,
  InlineLabel,
  type BeatsAndBarsSnapTo,
  type ScaleMode,
} from '@waveform-playlist/ui-components';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { useLoadingProgress } from '../../hooks/useLoadingProgress';

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 5px;
  align-items: center;
  padding-right: 15px;
  border-right: 1px solid var(--ifm-color-emphasis-300, #ddd);

  &:last-child {
    border-right: none;
  }
`;

// Audio files - each file is loaded and decoded once by the provider, however
// many clips name it
// All from Ubiquitous for consistency
const audioFiles = [
  { id: 'kick', src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/01_Kick.opus' },
  { id: 'hihat', src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/02_HiHat1.opus' },
  { id: 'claps', src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/04_Claps.opus' },
  { id: 'shakers', src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/07_Shakers.opus' },
  { id: 'bass', src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/08_Bass.opus' },
  {
    id: 'synth1',
    src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.opus',
  },
  { id: 'synth2', src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/11_Synth2.opus' },
];

// Track configuration with multiple clips demonstrating gaps and positioning
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
    clips: [{ fileId: 'hihat', startTime: 4, duration: 12, offset: 4 }],
  },
  {
    name: 'Claps',
    clips: [
      { fileId: 'claps', startTime: 8, duration: 4, offset: 0 },
      { fileId: 'claps', startTime: 16, duration: 4, offset: 4 },
    ],
  },
  {
    name: 'Shakers',
    clips: [
      { fileId: 'shakers', startTime: 0, duration: 6, offset: 0 },
      { fileId: 'shakers', startTime: 10, duration: 6, offset: 6 },
    ],
  },
  {
    name: 'Bass',
    clips: [{ fileId: 'bass', startTime: 0, duration: 20, offset: 0 }],
  },
  {
    name: 'Synth 1',
    clips: [
      { fileId: 'synth1', startTime: 4, duration: 8, offset: 2 },
      { fileId: 'synth1', startTime: 14, duration: 6, offset: 10 },
    ],
  },
  {
    name: 'Synth 2',
    clips: [
      { fileId: 'synth2', startTime: 0, duration: 4, offset: 0 },
      { fileId: 'synth2', startTime: 8, duration: 4, offset: 4 },
      { fileId: 'synth2', startTime: 16, duration: 4, offset: 8 },
    ],
  },
];

const fileSrc = (fileId: string) => audioFiles.find((file) => file.id === fileId)!.src;

// Build tracks from config. Each clip is a loading clip in seconds with its own
// stable id; its duration lets the provider draw it as a placeholder at once,
// and the provider resolves it when its file has decoded.
const buildTracks = (): PlaylistTrack[] =>
  trackConfigs.map((trackConfig) => {
    const clips: LoadingClip[] = trackConfig.clips.map((clipConfig, index) => ({
      id: `${clipConfig.fileId}-${index}`,
      src: fileSrc(clipConfig.fileId),
      start: clipConfig.startTime,
      duration: clipConfig.duration,
      offset: clipConfig.offset,
      name: `${trackConfig.name} ${clipConfig.offset}-${clipConfig.offset + clipConfig.duration}s`,
    }));

    return {
      ...createTrack({
        name: trackConfig.name,
        clips: [],
        muted: false,
        soloed: false,
        volume: 1,
        pan: 0,
      }),
      clips,
    };
  });

// Inside the provider: "Loading: 3/7" while the files load, or the error of one that failed.
function LoadingStatus() {
  const { isLoading, settledCount, totalCount, errorMessage } = useLoadingProgress();
  if (errorMessage) {
    return <span style={{ fontSize: '0.875rem', color: 'red' }}>Error loading audio: {errorMessage}</span>;
  }
  if (!isLoading) return null;
  return (
    <span style={{ fontSize: '0.875rem', color: 'var(--ifm-color-emphasis-600)' }}>
      Loading: {settledCount}/{totalCount}
    </span>
  );
}

export function BeatsAndBarsExample() {
  const { theme } = useDocusaurusTheme();

  const [scaleMode, setScaleMode] = useState<ScaleMode>('beats');
  const [bpm, setBpm] = useState(126);
  const [timeSignature, setTimeSignature] = useState<[number, number]>([4, 4]);
  const [snapTo, setSnapTo] = useState<BeatsAndBarsSnapTo>('beat');
  const [temporalSnap, setTemporalSnap] = useState(true);

  // One tracks state, created once: placeholder clips render immediately and
  // the provider builds the engine once every file has loaded.
  const [tracksState, setTracks] = useState<PlaylistTrack[]>(buildTracks);

  const snap = scaleMode === 'beats' ? snapTo !== 'off' : temporalSnap;

  return (
    <WaveformPlaylistProvider
      tracks={tracksState}
      sampleRate={48000}
      onTracksChange={setTracks}
      samplesPerPixel={1024}
      mono
      automaticScroll
      theme={theme}
      indefinitePlayback
    >
      <BeatsAndBarsProvider bpm={bpm} timeSignature={timeSignature} snapTo={snapTo} scaleMode={scaleMode}>
        <ClipInteractionProvider snap={snap}>
          <KeyboardShortcuts playback clipSplitting undo />
          <Controls>
            <ControlGroup>
              <PlayButton />
              <PauseButton />
              <StopButton />
              <LoopButton />
              <LoadingStatus />
            </ControlGroup>
            <ControlGroup>
              <ZoomInButton />
              <ZoomOutButton />
            </ControlGroup>
            <ControlGroup>
              <AudioPosition />
            </ControlGroup>
            <ControlGroup>
              <AutomaticScrollCheckbox />
            </ControlGroup>
            <ControlGroup>
              <MasterVolumeControl />
            </ControlGroup>
          </Controls>
          <Controls>
            <ControlGroup>
              <InlineLabel>
                Scale{' '}
                <BaseSelectSmall
                  value={scaleMode}
                  onChange={(e) => setScaleMode(e.target.value as ScaleMode)}
                >
                  <option value="beats">Beats &amp; Bars</option>
                  <option value="temporal">Temporal</option>
                </BaseSelectSmall>
              </InlineLabel>
            </ControlGroup>
            {scaleMode === 'beats' ? (
              <>
                <ControlGroup>
                  <InlineLabel>
                    BPM{' '}
                    <BaseInputSmall
                      type="number"
                      min={20}
                      max={300}
                      value={bpm}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val >= 20 && val <= 300) setBpm(val);
                      }}
                      style={{ width: 60 }}
                    />
                  </InlineLabel>
                </ControlGroup>
                <ControlGroup>
                  <InlineLabel>
                    Time Sig{' '}
                    <BaseSelectSmall
                      value={`${timeSignature[0]}/${timeSignature[1]}`}
                      onChange={(e) => {
                        const [num, den] = e.target.value.split('/').map(Number);
                        setTimeSignature([num, den]);
                      }}
                    >
                      <option value="4/4">4/4</option>
                      <option value="3/4">3/4</option>
                      <option value="6/8">6/8</option>
                      <option value="2/2">2/2</option>
                      <option value="5/4">5/4</option>
                      <option value="7/8">7/8</option>
                    </BaseSelectSmall>
                  </InlineLabel>
                </ControlGroup>
                <ControlGroup>
                  <InlineLabel>
                    Snap{' '}
                    <BaseSelectSmall
                      value={snapTo}
                      onChange={(e) => setSnapTo(e.target.value as BeatsAndBarsSnapTo)}
                    >
                      <option value="bar">Bar</option>
                      <option value="beat">Beat</option>
                      <option value="off">Off</option>
                    </BaseSelectSmall>
                  </InlineLabel>
                </ControlGroup>
              </>
            ) : (
              <ControlGroup>
                <InlineLabel>
                  Snap{' '}
                  <BaseSelectSmall
                    value={temporalSnap ? 'on' : 'off'}
                    onChange={(e) => setTemporalSnap(e.target.value === 'on')}
                  >
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </BaseSelectSmall>
                </InlineLabel>
              </ControlGroup>
            )}
          </Controls>

          <WaveformViewOptions waveHeight={100} barWidth={4} barGap={0}>
            <WaveformEditor />
          </WaveformViewOptions>
        </ClipInteractionProvider>
      </BeatsAndBarsProvider>
    </WaveformPlaylistProvider>
  );
}
