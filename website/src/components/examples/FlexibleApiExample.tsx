/**
 * Flexible API Example
 *
 * Demonstrates advanced customization with the flexible hooks API:
 * - Custom track control rendering with Radix UI
 * - Custom timestamp formatting
 * - Using individual hooks for fine-grained control
 * - Custom UI components instead of pre-built buttons
 * - Full theming customization
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Theme, Button, Flex, Card, Text, Separator, IconButton, Slider, Select, Switch, Badge } from '@radix-ui/themes';
import { PlayIcon, PauseIcon, StopIcon, ZoomInIcon, ZoomOutIcon, SpeakerLoudIcon, SpeakerOffIcon, StarFilledIcon, StarIcon } from '@radix-ui/react-icons';
import '@radix-ui/themes/styles.css';
import {
  WaveformPlaylistProvider,
  Waveform,
  useAudioTracks,
  usePlaylistControls,
  usePlaybackAnimation,
  usePlaylistData,
  usePlaylistState,
  useWaveformPlaylist,
  RewindButton,
  FastForwardButton,
  SkipBackwardButton,
  SkipForwardButton,
  type TimeFormat,
} from '@waveform-playlist/browser';
import { CLIP_HEADER_HEIGHT } from '@waveform-playlist/ui-components';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const TimeDisplay = styled.div`
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--accent-11);
  min-width: 100px;
  text-align: center;
`;

const VolumeDisplay = styled.div`
  font-size: 0.875rem;
  color: var(--gray-11);
  font-weight: 500;
  min-width: 45px;
  text-align: right;
`;

// Styled components for custom track controls
const TrackControlsContainer = styled.div`
  padding: 0.4rem 0.5rem;
  background: linear-gradient(135deg, #2c3e50 0%, #1a252f 100%);
  color: white;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  width: 120px;
  height: ${100 + CLIP_HEADER_HEIGHT}px;
  box-sizing: border-box;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;

  &:hover {
    background: linear-gradient(135deg, #34495e 0%, #1f2d3a 100%);
  }
`;

const TrackTitle = styled.h4`
  margin: 0;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  text-align: center;
  padding-bottom: 0.2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const TrackButtonsRow = styled.div`
  display: flex;
  gap: 0.3rem;
`;

const TrackButton = styled.button<{ $active?: boolean; $type?: 'mute' | 'solo' }>`
  padding: 0.25rem 0.4rem;
  font-size: 0.625rem;
  background: ${props => {
    if (props.$active) {
      return props.$type === 'mute' ? '#e74c3c' : '#3498db';
    }
    return '#455a64';
  }};
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  flex: 1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  min-width: 0;

  &:hover:not(:disabled) {
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }
`;

const VolumeContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0 0.5rem;
`;

const VolumeLabel = styled.label`
  font-size: 0.6rem;
  font-weight: 600;
  color: #95a5a6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: center;
`;

const StyledRangeInput = styled.input.attrs({ type: 'range' })<{ $value: number }>`
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(
    to right,
    #5dade2 0%,
    #5dade2 ${props => props.$value * 100}%,
    #1a252f ${props => props.$value * 100}%,
    #1a252f 100%
  );
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #5dade2;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      transform: scale(1.3);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5), 0 0 8px rgba(93, 173, 226, 0.5);
    }

    &:active {
      transform: scale(1.15);
    }
  }

  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #5dade2;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    border: none;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      transform: scale(1.3);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5), 0 0 8px rgba(93, 173, 226, 0.5);
    }

    &:active {
      transform: scale(1.15);
    }
  }
`;

// Custom Track Controls Component
const CustomTrackControls: React.FC<{ trackIndex: number }> = ({ trackIndex }) => {
  const { trackStates, setTrackMute, setTrackSolo, setTrackVolume } = useWaveformPlaylist();
  const trackState = trackStates[trackIndex];

  if (!trackState) return null;

  const trackName = trackState.name || `Track ${trackIndex + 1}`;

  return (
    <TrackControlsContainer>
      <TrackTitle>{trackName}</TrackTitle>
      <TrackButtonsRow>
        <Button
          size="1"
          variant={trackState.muted ? "solid" : "soft"}
          color={trackState.muted ? "red" : "gray"}
          onClick={() => setTrackMute(trackIndex, !trackState.muted)}
          style={{ flex: 1, minWidth: 0 }}
        >
          M
        </Button>
        <Button
          size="1"
          variant={trackState.soloed ? "solid" : "soft"}
          color={trackState.soloed ? "amber" : "gray"}
          onClick={() => setTrackSolo(trackIndex, !trackState.soloed)}
          style={{ flex: 1, minWidth: 0 }}
        >
          S
        </Button>
      </TrackButtonsRow>
      <VolumeContainer>
        <VolumeLabel>Volume</VolumeLabel>
        <Slider
          value={[trackState.volume * 100]}
          onValueChange={([v]) => setTrackVolume(trackIndex, v / 100)}
          min={0}
          max={100}
          step={1}
          size="1"
        />
      </VolumeContainer>
    </TrackControlsContainer>
  );
};

// Helper to format time based on selected format
const formatTime = (seconds: number, format: TimeFormat): string => {
  if (format === 'hh:mm:ss') {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else if (format === 'hh:mm:ss.u') {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  } else if (format === 'hh:mm:ss.uu') {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  } else if (format === 'hh:mm:ss.uuu') {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
  return seconds.toFixed(3);
};

// Main Example Content Component - Using individual hooks with Radix UI
const FlexibleApiContent: React.FC = () => {
  const { play, pause, stop, setMasterVolume, setTimeFormat, setAutomaticScroll, zoomIn, zoomOut } = usePlaylistControls();
  const { currentTime } = usePlaybackAnimation();
  const { duration, sampleRate, masterVolume, timeFormat } = usePlaylistData();
  const { isAutomaticScroll } = usePlaylistState();

  // Format current time based on selected format
  const formattedTime = formatTime(currentTime, timeFormat);
  const formattedDuration = formatTime(duration, timeFormat);

  return (
    <Flex direction="column" gap="3">
      {/* Main Transport Controls */}
      <Card>
        <Flex gap="3" align="center" wrap="wrap">
          <Flex gap="2">
            <RewindButton />
            <SkipBackwardButton />
            <Button onClick={() => play()} variant="solid" color="green">
              <PlayIcon width="16" height="16" />
              Play
            </Button>
            <Button onClick={pause} variant="soft">
              <PauseIcon width="16" height="16" />
              Pause
            </Button>
            <Button onClick={stop} variant="soft">
              <StopIcon width="16" height="16" />
              Stop
            </Button>
            <SkipForwardButton />
            <FastForwardButton />
          </Flex>

          <Separator orientation="vertical" />

          <TimeDisplay>{formattedTime} / {formattedDuration}</TimeDisplay>

          <Separator orientation="vertical" />

          <Flex gap="2" align="center">
            <Text size="2" color="gray">Format:</Text>
            <Select.Root value={timeFormat} onValueChange={(v) => setTimeFormat(v as TimeFormat)}>
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="seconds">Seconds</Select.Item>
                <Select.Item value="hh:mm:ss">hh:mm:ss</Select.Item>
                <Select.Item value="hh:mm:ss.u">hh:mm:ss.u</Select.Item>
                <Select.Item value="hh:mm:ss.uu">hh:mm:ss.uu</Select.Item>
                <Select.Item value="hh:mm:ss.uuu">hh:mm:ss.uuu</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>
        </Flex>
      </Card>

      {/* Zoom and View Controls */}
      <Card>
        <Flex gap="3" align="center" wrap="wrap">
          <Flex gap="2" align="center">
            <Text size="2" color="gray">Zoom:</Text>
            <Button onClick={zoomIn} size="2" variant="soft">
              <ZoomInIcon width="16" height="16" />
              In
            </Button>
            <Button onClick={zoomOut} size="2" variant="soft">
              <ZoomOutIcon width="16" height="16" />
              Out
            </Button>
          </Flex>

          <Separator orientation="vertical" />

          <Flex gap="2" align="center">
            <Text size="2" color="gray">Auto-scroll:</Text>
            <Switch
              checked={isAutomaticScroll}
              onCheckedChange={setAutomaticScroll}
            />
          </Flex>

          <Separator orientation="vertical" />

          <Flex gap="2" align="center" style={{ minWidth: '200px' }}>
            <SpeakerLoudIcon width="16" height="16" />
            <Text size="2" color="gray">Volume:</Text>
            <Slider
              value={[masterVolume * 100]}
              onValueChange={([v]) => setMasterVolume(v / 100)}
              min={0}
              max={100}
              step={1}
              style={{ flex: 1 }}
            />
            <VolumeDisplay>{Math.round(masterVolume * 100)}%</VolumeDisplay>
          </Flex>
        </Flex>
      </Card>

      <Waveform
        renderTrackControls={(trackIndex) => (
          <CustomTrackControls trackIndex={trackIndex} />
        )}
        showClipHeaders={true}
      />
    </Flex>
  );
};

// Main Example Component
export function FlexibleApiExample() {
  const theme = useDocusaurusTheme();

  // Detect Docusaurus theme for Radix
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    return () => observer.disconnect();
  }, []);

  // Custom theme with dark blue/teal aesthetic (matching old flexible-api example)
  const customTheme = {
    ...theme,
    // Waveforms - Dark blue outline with light blue fill
    waveOutlineColor: '#1e3a5f',
    waveFillColor: '#5dade2',
    waveProgressColor: '#e74c3c',
    selectedWaveOutlineColor: '#3a5a8f', // Brighter blue for selected waveforms
    selectedWaveFillColor: '#5dade2',

    // Playback UI - Red accents for contrast
    playheadColor: '#8b0000', // Dark red playhead
    selectionColor: 'rgba(231, 76, 60, 0.5)', // Light red selection

    // Track controls - Subtle blue tint for selected tracks
    selectedTrackControlsBackground: 'rgba(52, 152, 219, 0.2)',

    // Clip headers - Dark blue-gray with light blue accents
    clipHeaderBackgroundColor: 'rgba(44, 62, 80, 0.85)',
    clipHeaderBorderColor: 'rgba(93, 173, 226, 0.4)',
    clipHeaderTextColor: '#ecf0f1',
    selectedClipHeaderBackgroundColor: 'rgba(52, 152, 219, 0.4)',

    // Timescale
    timeColor: '#ecf0f1',
    timescaleBackgroundColor: '#2c3e50',
  };

  const audioConfigs = React.useMemo(() => [
    {
      src: '/waveform-playlist/media/audio/Vocals30.mp3',
      name: 'Vocals',
    },
    {
      src: '/waveform-playlist/media/audio/Guitar30.mp3',
      name: 'Guitar',
    },
    {
      src: '/waveform-playlist/media/audio/PianoSynth30.mp3',
      name: 'Piano Synth',
    },
    {
      src: '/waveform-playlist/media/audio/BassDrums30.mp3',
      name: 'Bass & Drums',
    },
  ], []);

  const { tracks, loading, error } = useAudioTracks(audioConfigs);
  const [localTracks, setLocalTracks] = useState(tracks);

  // Update local tracks when loaded
  React.useEffect(() => {
    if (tracks.length > 0) {
      setLocalTracks(tracks);
    }
  }, [tracks]);

  if (loading) {
    return (
      <Theme appearance={isDark ? 'dark' : 'light'} accentColor="blue" grayColor="slate" radius="medium">
        <Container>
          <Card>
            <Flex justify="center" align="center" style={{ padding: '3rem' }}>
              <Text size="3">Loading audio tracks...</Text>
            </Flex>
          </Card>
        </Container>
      </Theme>
    );
  }

  if (error) {
    return (
      <Theme appearance={isDark ? 'dark' : 'light'} accentColor="blue" grayColor="slate" radius="medium">
        <Container>
          <Card style={{ background: 'var(--red-3)', border: '1px solid var(--red-6)' }}>
            <Text size="3" color="red">
              Error loading audio: {error}
            </Text>
          </Card>
        </Container>
      </Theme>
    );
  }

  return (
    <Theme appearance={isDark ? 'dark' : 'light'} accentColor="blue" grayColor="slate" radius="medium">
      <Container>
        <WaveformPlaylistProvider
          tracks={localTracks}
          samplesPerPixel={1024}
          mono={true}
          waveHeight={100}
          automaticScroll={false}
          controls={{ show: true, width: 120 }}
          theme={customTheme}
        >
          <FlexibleApiContent />
        </WaveformPlaylistProvider>

        <Card style={{ marginTop: '2rem', background: 'var(--gray-2)' }}>
          <Flex direction="column" gap="2">
            <Text size="3" weight="bold">💡 About This Example</Text>
            <Text size="2" color="gray">
              This example demonstrates the <strong>flexible hooks API</strong> - using individual hooks to build
              completely custom controls with Radix UI components. Instead of using pre-built components like
              <code>PlayButton</code> or <code>AudioPosition</code>, this example shows:
            </Text>
            <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
              <li><Text size="2" color="gray"><code>usePlaylistControls()</code> - Get <code>play</code>, <code>pause</code>, <code>stop</code> functions</Text></li>
              <li><Text size="2" color="gray"><code>usePlaybackAnimation()</code> - Get <code>currentTime</code> for live position</Text></li>
              <li><Text size="2" color="gray"><code>usePlaylistData()</code> - Get <code>duration</code>, <code>sampleRate</code>, etc.</Text></li>
              <li><Text size="2" color="gray"><code>usePlaylistState()</code> - Get/set <code>timeFormat</code>, <code>masterVolume</code>, <code>isAutomaticScroll</code>, etc.</Text></li>
              <li><Text size="2" color="gray">Custom time formatting with <code>formatTime()</code> helper</Text></li>
              <li><Text size="2" color="gray">Radix UI components (<code>Button</code>, <code>Slider</code>, <code>Switch</code>, <code>Select</code>)</Text></li>
            </ul>
            <Text size="2" color="gray">
              This gives you maximum flexibility - use any UI library (Radix, Material-UI, Chakra, etc.) and build exactly the interface you want!
            </Text>
          </Flex>
        </Card>
      </Container>
    </Theme>
  );
}
