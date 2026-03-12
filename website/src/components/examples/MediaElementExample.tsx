import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import type * as ToneNs from 'tone';
import {
  MediaElementPlaylistProvider,
  useMediaElementAnimation,
  useMediaElementState,
  useMediaElementControls,
  useMediaElementData,
  loadWaveformData,
  MediaElementWaveform,
} from '@waveform-playlist/browser';
import { PlayheadWithMarker } from '@waveform-playlist/ui-components';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

// Audio files with pre-computed peaks
const AUDIO_CONFIGS = [
  {
    source: '/waveform-playlist/storybook/media/audio/AlbertKader_Ubiquitous/08_Bass.opus',
    peaksSrc: '/waveform-playlist/storybook/media/audio/AlbertKader_Ubiquitous/08_Bass.dat',
    name: 'Bass',
  },
  {
    source: '/waveform-playlist/storybook/media/audio/AlbertKader_Ubiquitous/01_Kick.opus',
    peaksSrc: '/waveform-playlist/storybook/media/audio/AlbertKader_Ubiquitous/01_Kick.dat',
    name: 'Kick',
  },
];

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const Section = styled.div`
  margin-bottom: 2rem;
`;

const SectionLabel = styled.h3`
  margin-bottom: 0.5rem;
  font-size: 1rem;
  color: var(--ifm-font-color-secondary, #666);
`;

const Controls = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  background: var(--ifm-background-surface-color, #f8f9fa);
  border: 1px solid var(--ifm-color-emphasis-300, #dee2e6);
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const Button = styled.button<{ $active?: boolean }>`
  padding: 0.5rem 1rem;
  border: 1px solid var(--ifm-color-emphasis-300, #ccc);
  border-radius: 0.25rem;
  background: ${props => props.$active
    ? 'var(--ifm-color-primary, #3578e5)'
    : 'var(--ifm-background-color, white)'};
  color: ${props => props.$active
    ? 'white'
    : 'var(--ifm-font-color-base, #333)'};
  cursor: pointer;
  font-size: 1rem;

  &:hover {
    background: ${props => props.$active
      ? 'var(--ifm-color-primary-dark, #2a5db0)'
      : 'var(--ifm-color-emphasis-200, #eee)'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SpeedButton = styled(Button)`
  min-width: 50px;
`;

const Label = styled.span`
  font-size: 0.875rem;
  color: var(--ifm-font-color-secondary, #666);
  margin-right: 0.5rem;
`;

const TimeDisplay = styled.span`
  font-family: 'Courier New', monospace;
  font-size: 1rem;
  padding: 0.25rem 0.5rem;
  background: var(--ifm-color-emphasis-100, #f0f0f0);
  border-radius: 0.25rem;
  min-width: 80px;
  text-align: center;
`;


// Playback rate presets
const SPEED_PRESETS = [
  { label: '0.5x', value: 0.5 },
  { label: '0.75x', value: 0.75 },
  { label: '1x', value: 1 },
  { label: '1.25x', value: 1.25 },
  { label: '1.5x', value: 1.5 },
  { label: '2x', value: 2 },
];

// Format time as m:ss
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Controls component that uses the context hooks.
// currentTimeRef is updated at 60fps by the provider's animation loop,
// but currentTime (React state) only updates on pause/stop/seek/playback-end.
// We use a local rAF loop to update a DOM ref directly for smooth time display.
function PlaybackControls() {
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
        <Button onClick={() => play()} disabled={isPlaying}>
          ▶ Play
        </Button>
        <Button onClick={() => pause()} disabled={!isPlaying}>
          ⏸ Pause
        </Button>
        <Button onClick={() => stop()}>
          ⏹ Stop
        </Button>
      </ControlGroup>

      <ControlGroup>
        <TimeDisplay ref={timeDisplayRef}>
          {formatTime(currentTimeRef.current ?? 0)} / {formatTime(duration)}
        </TimeDisplay>
      </ControlGroup>

      <ControlGroup>
        <Label>Speed:</Label>
        {SPEED_PRESETS.map(preset => (
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

/**
 * Child component that wires the MediaElement output into a Tone.js effect chain.
 * Must be rendered inside MediaElementPlaylistProvider to access playoutRef.
 *
 * Bridge pattern: native GainNode → Tone.Gain.input (native→native) → Tone effect chain
 */
function EffectWiring({ audioContext }: { audioContext: AudioContext }) {
  const { playoutRef, duration } = useMediaElementData();

  // Wire the effect chain after the AudioContext is running (user gesture).
  // Tone.js is dynamically imported to avoid AudioWorklet errors on page load.
  useEffect(() => {
    const outputNode = playoutRef.current?.outputNode;
    if (!outputNode) return;

    let bridge: ToneNs.Gain | undefined;
    let crusher: ToneNs.BitCrusher | undefined;
    let disposed = false;

    const wireEffect = async () => {
      try {
        const Tone = await import('tone');
        if (disposed) return;

        // Tell Tone.js to use the same AudioContext as the provider
        Tone.setContext(new Tone.Context(audioContext));

        // Create bridge and effect on the shared context
        bridge = new Tone.Gain(1);
        crusher = new Tone.BitCrusher({ bits: 4, wet: 1 });

        // Disconnect native output from default destination
        outputNode.disconnect();

        // Native → native connection (outputNode → bridge.input)
        outputNode.connect(bridge.input);

        // Tone → Tone chain (bridge → crusher → destination)
        bridge.chain(crusher, Tone.getDestination());
      } catch (err) {
        console.warn('[waveform-playlist] EffectWiring: wireEffect() failed: ' + String(err));
        // Reconnect to default destination so audio isn't lost
        try {
          outputNode.connect(audioContext.destination);
        } catch {
          // Already connected or disposed
        }
      }
    };

    // Wait for user gesture (Play click) to resume the AudioContext.
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
      audioContext.removeEventListener('statechange', onStateChange);
      if (bridge) {
        try {
          outputNode.disconnect();
        } catch (err) {
          console.warn('[waveform-playlist] EffectWiring cleanup: disconnect failed: ' + String(err));
        }
        try {
          outputNode.connect(audioContext.destination);
        } catch (err) {
          console.warn('[waveform-playlist] EffectWiring cleanup: reconnect failed: ' + String(err));
        }
      }
      crusher?.dispose();
      bridge?.dispose();
    };
  }, [playoutRef, audioContext, duration]);

  return null;
}

/**
 * MediaElementExample
 *
 * Demonstrates the MediaElementPlaylistProvider for single-track playback
 * with pitch-preserving playback rate control.
 *
 * Shows three independent players:
 * 1. Default playhead (simple vertical line)
 * 2. Custom playhead with triangle marker (PlayheadWithMarker)
 * 3. Tone.js BitCrusher effect via native→Tone bridge
 */
export function MediaElementExample() {
  const { theme } = useDocusaurusTheme();
  const [trackConfigs, setTrackConfigs] = useState<Array<{ source: string; waveformData: any; name: string } | null>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Single AudioContext for the effect-bridged player — always needed since
  // the third player always renders. useState gives stable identity across renders.
  // Tone.Context created lazily in EffectWiring (after user gesture) to avoid
  // "No execution context available" from Tone.js AudioWorklet setup.
  const [effectAudioContext] = useState(() => new AudioContext());

  useEffect(() => {
    return () => {
      effectAudioContext.close();
    };
  }, [effectAudioContext]);

  // Load BBC peaks files and build track configs
  useEffect(() => {
    const loadAllPeaks = async () => {
      try {
        const results = await Promise.all(
          AUDIO_CONFIGS.map(config => loadWaveformData(config.peaksSrc))
        );
        setTrackConfigs(
          AUDIO_CONFIGS.map((config, i) => ({
            source: config.source,
            waveformData: results[i],
            name: config.name,
          }))
        );
        setLoading(false);
      } catch (err) {
        console.error('Error loading peaks:', err);
        setError(err instanceof Error ? err.message : 'Failed to load peaks');
        setLoading(false);
      }
    };

    loadAllPeaks();
  }, []);

  if (loading) {
    return (
      <Container>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          Loading waveform data...
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <div style={{ padding: '2rem', color: 'red' }}>
          Error: {error}
        </div>
      </Container>
    );
  }

  return (
    <Container>
      {trackConfigs[0] && (
        <Section>
          <SectionLabel>Default Playhead</SectionLabel>
          <MediaElementPlaylistProvider
            track={trackConfigs[0]}
            samplesPerPixel={512}
            waveHeight={120}
            theme={theme}
            barWidth={2}
            barGap={0}
          >
            <PlaybackControls />
            <MediaElementWaveform />
          </MediaElementPlaylistProvider>
        </Section>
      )}

      {trackConfigs[1] && (
        <Section>
          <SectionLabel>Custom Playhead (PlayheadWithMarker) + Timescale</SectionLabel>
          <MediaElementPlaylistProvider
            track={trackConfigs[1]}
            samplesPerPixel={512}
            waveHeight={120}
            theme={{ ...theme, playheadColor: '#00bcd4' }}
            timescale
            barWidth={2}
            barGap={0}
          >
            <PlaybackControls />
            <MediaElementWaveform renderPlayhead={PlayheadWithMarker} />
          </MediaElementPlaylistProvider>
        </Section>
      )}

      {trackConfigs[0] && (
        <Section>
          <SectionLabel>Tone.js Effect (BitCrusher via native→Tone bridge)</SectionLabel>
          <MediaElementPlaylistProvider
            track={trackConfigs[0]}
            audioContext={effectAudioContext}
            samplesPerPixel={512}
            waveHeight={120}
            theme={theme}
            barWidth={2}
            barGap={0}
          >
            <EffectWiring audioContext={effectAudioContext} />
            <PlaybackControls />
            <MediaElementWaveform />
          </MediaElementPlaylistProvider>
        </Section>
      )}
    </Container>
  );
}
