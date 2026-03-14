/**
 * Pitch Shifting Example
 *
 * Compares three approaches to pitch-preserving playback speed control:
 * 1. MediaElement — browser's built-in time-stretching via HTMLAudioElement.playbackRate
 * 2. MediaElement + SoundTouchNode — streaming audio through an AudioWorklet
 * 3. WebAudio + SoundTouchNode — decoded audio through an AudioWorklet
 *
 * SoundTouchNode works directly because the website patches global
 * AudioWorkletNode/GainNode with standardized-audio-context versions
 * (see patchAudioWorklet.ts / clientModules in docusaurus.config.ts).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  AudioPosition,
  useAudioTracks,
  KeyboardShortcuts,
} from '@waveform-playlist/browser';
import {
  MediaElementPlaylistProvider,
  useMediaElementAnimation,
  useMediaElementState,
  useMediaElementControls,
  useMediaElementData,
  loadWaveformData,
  MediaElementWaveform,
} from '@waveform-playlist/browser';
import { getGlobalAudioContext } from '@waveform-playlist/playout';
import type { EffectsFunction } from '@waveform-playlist/playout';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

// --- Audio config ---

const WEBAUDIO_CONFIGS = [
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/08_Bass.opus',
    name: 'Bass',
  },
];

const MEDIA_ELEMENT_CONFIG = {
  source: '/waveform-playlist/storybook/media/audio/AlbertKader_Ubiquitous/08_Bass.opus',
  peaksSrc: '/waveform-playlist/storybook/media/audio/AlbertKader_Ubiquitous/08_Bass.dat',
  name: 'Bass',
};

const SOUNDTOUCH_PROCESSOR_URL = '/waveform-playlist/media/worklets/soundtouch-processor.js';

// --- Styled components ---

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const Section = styled.div`
  margin-bottom: 2.5rem;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 1.1rem;
`;

const Badge = styled.span<{ $variant: 'browser' | 'worklet' }>`
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: ${(props) =>
    props.$variant === 'browser'
      ? '#1b5e20'
      : '#b45309'};
  color: #fff;
`;

const SectionDescription = styled.p`
  font-size: 0.9rem;
  color: var(--ifm-font-color-secondary, #666);
  margin-bottom: 1rem;
`;

const Controls = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--ifm-background-surface-color, #f8f9fa);
  border: 1px solid var(--ifm-color-emphasis-300, #dee2e6);
  border-radius: 0.5rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const Button = styled.button<{ $active?: boolean }>`
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--ifm-color-emphasis-300, #ccc);
  border-radius: 0.25rem;
  background: ${(props) =>
    props.$active
      ? 'var(--ifm-color-primary, #3578e5)'
      : 'var(--ifm-background-color, white)'};
  color: ${(props) =>
    props.$active ? 'white' : 'var(--ifm-font-color-base, #333)'};
  cursor: pointer;
  font-size: 0.875rem;

  &:hover {
    background: ${(props) =>
      props.$active
        ? 'var(--ifm-color-primary-dark, #2a5db0)'
        : 'var(--ifm-color-emphasis-200, #eee)'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SpeedButton = styled(Button)`
  min-width: 44px;
  font-size: 0.8rem;
`;

const Label = styled.span`
  font-size: 0.8rem;
  color: var(--ifm-font-color-secondary, #666);
`;

const TimeDisplay = styled.span`
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  padding: 0.2rem 0.5rem;
  background: var(--ifm-color-emphasis-100, #f0f0f0);
  border-radius: 0.25rem;
  min-width: 70px;
  text-align: center;
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid var(--ifm-color-emphasis-200, #eee);
  margin: 2rem 0;
`;

// --- Speed presets ---

const SPEED_PRESETS = [
  { label: '0.5x', value: 0.5 },
  { label: '0.75x', value: 0.75 },
  { label: '1x', value: 1 },
  { label: '1.25x', value: 1.25 },
  { label: '1.5x', value: 1.5 },
  { label: '2x', value: 2 },
];

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// --- Shared hook for loading MediaElement track config ---

function useMediaElementTrack() {
  const [trackConfig, setTrackConfig] = useState<{
    source: string;
    waveformData: any;
    name: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const waveformData = await loadWaveformData(MEDIA_ELEMENT_CONFIG.peaksSrc);
        setTrackConfig({
          source: MEDIA_ELEMENT_CONFIG.source,
          waveformData,
          name: MEDIA_ELEMENT_CONFIG.name,
        });
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load peaks');
        setLoading(false);
      }
    };
    load();
  }, []);

  return { trackConfig, loading, error };
}

// --- MediaElement playback controls with speed buttons ---

function MediaElementSpeedControls() {
  const { isPlaying, currentTimeRef } = useMediaElementAnimation();
  const { playbackRate } = useMediaElementState();
  const { play, pause, stop, setPlaybackRate } = useMediaElementControls();
  const { duration } = useMediaElementData();

  const timeDisplayRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let rafId: number;
    const update = () => {
      if (timeDisplayRef.current) {
        const time = currentTimeRef.current ?? 0;
        timeDisplayRef.current.textContent = `${formatTime(time)} / ${formatTime(duration)}`;
      }
      if (isPlaying) {
        rafId = requestAnimationFrame(update);
      }
    };
    if (isPlaying) {
      rafId = requestAnimationFrame(update);
    } else {
      update();
    }
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, currentTimeRef, duration]);

  return (
    <Controls>
      <ControlGroup>
        <Button onClick={() => play()} disabled={isPlaying}>Play</Button>
        <Button onClick={() => pause()} disabled={!isPlaying}>Pause</Button>
        <Button onClick={() => stop()}>Stop</Button>
      </ControlGroup>

      <TimeDisplay ref={timeDisplayRef}>
        {formatTime(currentTimeRef.current ?? 0)} / {formatTime(duration)}
      </TimeDisplay>

      <ControlGroup>
        <Label>Speed:</Label>
        {SPEED_PRESETS.map((preset) => (
          <SpeedButton
            key={preset.value}
            $active={playbackRate === preset.value}
            onClick={() => setPlaybackRate(preset.value)}
          >
            {preset.label}
          </SpeedButton>
        ))}
      </ControlGroup>
    </Controls>
  );
}

// --- MediaElement playback controls with SoundTouch speed ---

function MediaElementSoundTouchControls({
  tempo,
  onTempoChange,
}: {
  tempo: number;
  onTempoChange: (value: number) => void;
}) {
  const { isPlaying, currentTimeRef } = useMediaElementAnimation();
  const { play, pause, stop, setPlaybackRate } = useMediaElementControls();
  const { duration } = useMediaElementData();

  const timeDisplayRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let rafId: number;
    const update = () => {
      if (timeDisplayRef.current) {
        const time = currentTimeRef.current ?? 0;
        timeDisplayRef.current.textContent = `${formatTime(time)} / ${formatTime(duration)}`;
      }
      if (isPlaying) {
        rafId = requestAnimationFrame(update);
      }
    };
    if (isPlaying) {
      rafId = requestAnimationFrame(update);
    } else {
      update();
    }
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, currentTimeRef, duration]);

  return (
    <Controls>
      <ControlGroup>
        <Button onClick={() => play()} disabled={isPlaying}>Play</Button>
        <Button onClick={() => pause()} disabled={!isPlaying}>Pause</Button>
        <Button onClick={() => stop()}>Stop</Button>
      </ControlGroup>

      <TimeDisplay ref={timeDisplayRef}>
        {formatTime(currentTimeRef.current ?? 0)} / {formatTime(duration)}
      </TimeDisplay>

      <ControlGroup>
        <Label>Speed:</Label>
        {SPEED_PRESETS.map((preset) => (
          <SpeedButton
            key={preset.value}
            $active={tempo === preset.value}
            onClick={() => {
              // Set audioElement.playbackRate via provider (actual speed change)
              setPlaybackRate(preset.value);
              // Tell SoundTouch the source rate so it compensates pitch
              onTempoChange(preset.value);
            }}
          >
            {preset.label}
          </SpeedButton>
        ))}
      </ControlGroup>
    </Controls>
  );
}

// --- SoundTouch wiring for MediaElement ---

function SoundTouchWiring({
  soundTouchRef,
}: {
  soundTouchRef: React.MutableRefObject<any | null>;
}) {
  const { playoutRef, duration } = useMediaElementData();
  const audioContext = getGlobalAudioContext();

  useEffect(() => {
    const outputNode = playoutRef.current?.outputNode;
    if (!outputNode) return;

    let stNode: any;
    let disposed = false;

    const wireEffect = async () => {
      try {
        const { SoundTouchNode } = await import('@soundtouchjs/audio-worklet');
        if (disposed) return;

        await SoundTouchNode.register(audioContext, SOUNDTOUCH_PROCESSOR_URL);

        stNode = new SoundTouchNode(audioContext);
        soundTouchRef.current = stNode;

        outputNode.disconnect();
        outputNode.connect(stNode);
        stNode.connect(audioContext.destination);
      } catch (err) {
        console.warn(
          '[waveform-playlist] SoundTouchWiring: wireEffect() failed: ' + String(err)
        );
        try {
          outputNode.connect(audioContext.destination);
        } catch {
          // Already connected or disposed
        }
      }
    };

    const onStateChange = () => {
      if (audioContext.state === 'running') {
        audioContext.removeEventListener('statechange', onStateChange);
        wireEffect();
      }
    };

    if (audioContext.state === 'running') {
      wireEffect();
    } else {
      audioContext.addEventListener('statechange', onStateChange);
    }

    return () => {
      disposed = true;
      soundTouchRef.current = null;
      audioContext.removeEventListener('statechange', onStateChange);
      if (stNode) {
        try {
          outputNode.disconnect();
        } catch (err) {
          console.warn('[waveform-playlist] SoundTouchWiring cleanup: disconnect failed: ' + String(err));
        }
        try {
          outputNode.connect(audioContext.destination);
        } catch (err) {
          console.warn('[waveform-playlist] SoundTouchWiring cleanup: reconnect failed: ' + String(err));
        }
        stNode.disconnect();
      }
    };
  }, [playoutRef, audioContext, duration, soundTouchRef]);

  return null;
}

// --- Section 1: MediaElement with browser speed control ---

function BrowserSpeedSection({ theme }: { theme: any }) {
  const { trackConfig, loading, error } = useMediaElementTrack();

  if (loading) return <Label>Loading waveform data...</Label>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  if (!trackConfig) return null;

  return (
    <MediaElementPlaylistProvider
      track={trackConfig}
      samplesPerPixel={512}
      waveHeight={100}
      theme={theme}
      barWidth={2}
      barGap={0}
    >
      <MediaElementSpeedControls />
      <MediaElementWaveform />
    </MediaElementPlaylistProvider>
  );
}

// --- Section 2: MediaElement + SoundTouchNode ---

function MediaElementSoundTouchSection({ theme }: { theme: any }) {
  const { trackConfig, loading, error } = useMediaElementTrack();
  const [tempo, setTempo] = useState(1);
  const soundTouchRef = useRef<any | null>(null);

  // Tell SoundTouch the source's playback rate so it compensates pitch.
  // The actual speed change comes from audioElement.playbackRate (set by
  // the controls component via setPlaybackRate from the provider).
  const handleTempoChange = useCallback((value: number) => {
    setTempo(value);
    if (soundTouchRef.current) {
      soundTouchRef.current.playbackRate.value = value;
    }
  }, []);

  if (loading) return <Label>Loading waveform data...</Label>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  if (!trackConfig) return null;

  return (
    <MediaElementPlaylistProvider
      track={trackConfig}
      audioContext={getGlobalAudioContext()}
      preservesPitch={false}
      samplesPerPixel={512}
      waveHeight={100}
      theme={theme}
      barWidth={2}
      barGap={0}
    >
      <SoundTouchWiring soundTouchRef={soundTouchRef} />
      <MediaElementSoundTouchControls tempo={tempo} onTempoChange={handleTempoChange} />
      <MediaElementWaveform />
    </MediaElementPlaylistProvider>
  );
}

// --- Section 3: WebAudio + SoundTouchNode ---

function WebAudioSoundTouchSection({ theme }: { theme: any }) {
  const audioConfigs = React.useMemo(() => WEBAUDIO_CONFIGS, []);
  const { tracks, loading, error } = useAudioTracks(audioConfigs, { immediate: true });

  const [tempo, setTempo] = useState(1);
  const soundTouchRef = useRef<any | null>(null);

  // EffectsFunction: masterGainNode (Tone.js Volume) → SoundTouchNode → destination
  // SoundTouchNode now extends the SAC AudioWorkletNode (via global patch),
  // so it connects directly to other SAC/Tone nodes.
  const masterEffects: EffectsFunction = useCallback((masterGainNode, destination) => {
    let stNode: any;

    // Connect directly first so audio plays immediately
    masterGainNode.connect(destination);

    // Wire SoundTouch asynchronously, then splice into the chain
    (async () => {
      try {
        const { SoundTouchNode } = await import('@soundtouchjs/audio-worklet');
        const audioContext = getGlobalAudioContext();

        await SoundTouchNode.register(audioContext, SOUNDTOUCH_PROCESSOR_URL);

        stNode = new SoundTouchNode(audioContext);
        soundTouchRef.current = stNode;

        // Disconnect direct path, splice in SoundTouch
        masterGainNode.disconnect(destination);
        masterGainNode.connect(stNode);
        stNode.connect(destination);
      } catch (err) {
        console.warn('[waveform-playlist] WebAudio SoundTouch wiring failed: ' + String(err));
      }
    })();

    return () => {
      soundTouchRef.current = null;
      stNode?.disconnect();
    };
  }, []);

  // WebAudio: can't control per-source playbackRate through Tone.js,
  // so use SoundTouch's tempo param for internal time-stretching.
  const handleTempoChange = useCallback((value: number) => {
    setTempo(value);
    if (soundTouchRef.current) {
      soundTouchRef.current.tempo.value = value;
    }
  }, []);

  if (error) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={512}
      mono
      theme={theme}
      waveHeight={100}
      effects={masterEffects}
      barWidth={2}
      barGap={0}
    >
      <KeyboardShortcuts playback />
      <Controls>
        <ControlGroup>
          <PlayButton />
          <PauseButton />
          <StopButton />
        </ControlGroup>
        <AudioPosition />
        <ControlGroup>
          <Label>Speed:</Label>
          {SPEED_PRESETS.map((preset) => (
            <SpeedButton
              key={preset.value}
              $active={tempo === preset.value}
              onClick={() => handleTempoChange(preset.value)}
            >
              {preset.label}
            </SpeedButton>
          ))}
        </ControlGroup>
        {loading && <Label>Loading...</Label>}
      </Controls>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}

// --- Main example ---

export function PitchShiftingExample() {
  const { theme } = useDocusaurusTheme();

  return (
    <Container>
      <Section>
        <SectionHeader>
          <SectionTitle>1. MediaElement — Browser Speed Control</SectionTitle>
          <Badge $variant="browser">Browser API</Badge>
        </SectionHeader>
        <SectionDescription>
          Streams audio via <code>HTMLAudioElement</code>. The browser&apos;s
          built-in time-stretching algorithm changes tempo while preserving
          pitch — no additional libraries needed.
        </SectionDescription>
        <BrowserSpeedSection theme={theme} />
      </Section>

      <Divider />

      <Section>
        <SectionHeader>
          <SectionTitle>2. MediaElement + SoundTouch</SectionTitle>
          <Badge $variant="worklet">AudioWorklet</Badge>
        </SectionHeader>
        <SectionDescription>
          Streams audio via <code>HTMLAudioElement</code>, then routes through
          a <code>SoundTouchNode</code> AudioWorklet for pitch-preserving
          tempo control. Same result as the browser API above, but running
          through the Web Audio graph — ready for additional effect chaining.
        </SectionDescription>
        <MediaElementSoundTouchSection theme={theme} />
      </Section>

      <Divider />

      <Section>
        <SectionHeader>
          <SectionTitle>3. WebAudio + SoundTouch</SectionTitle>
          <Badge $variant="worklet">AudioWorklet</Badge>
        </SectionHeader>
        <SectionDescription>
          Decodes the entire file into memory for sample-accurate playback,
          then routes through <code>SoundTouchNode</code> as a master effect.
          Same pitch-preserving speed control with the full WebAudio pipeline
          for multi-track editing.
        </SectionDescription>
        <WebAudioSoundTouchSection theme={theme} />
      </Section>
    </Container>
  );
}
