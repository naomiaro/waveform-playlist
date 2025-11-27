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

import React, { useRef, useEffect } from 'react';
import { getContext } from 'tone';
import styled from 'styled-components';
import { Theme, Button, Flex, Card, Text, Separator, Slider, Select, Switch, TextField } from '@radix-ui/themes';
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  SpeakerHighIcon,
  SkipBackIcon,
  SkipForwardIcon,
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  LightbulbIcon
} from '@phosphor-icons/react';
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
  type TimeFormat,
} from '@waveform-playlist/browser';
import { CLIP_HEADER_HEIGHT, PlayheadWithMarker, formatTime, parseTime } from '@waveform-playlist/ui-components';
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

/**
 * Animated time display that updates via requestAnimationFrame for smooth 60fps updates.
 * Uses direct DOM manipulation instead of React state to avoid throttling.
 */
interface AnimatedTimeDisplayProps {
  duration: number;
  format: TimeFormat;
}

const AnimatedTimeDisplayComponent: React.FC<AnimatedTimeDisplayProps> = ({ duration, format }) => {
  const timeRef = useRef<HTMLSpanElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const { isPlaying, currentTimeRef, playbackStartTimeRef, audioStartPositionRef } = usePlaybackAnimation();

  const formattedDuration = formatTime(duration, format);

  useEffect(() => {
    const updateTime = () => {
      if (timeRef.current) {
        let time: number;
        if (isPlaying) {
          const elapsed = getContext().currentTime - (playbackStartTimeRef.current ?? 0);
          time = (audioStartPositionRef.current ?? 0) + elapsed;
        } else {
          time = currentTimeRef.current ?? 0;
        }
        timeRef.current.textContent = formatTime(time, format);
      }

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    };

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateTime);
    } else {
      updateTime();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, format, currentTimeRef, playbackStartTimeRef, audioStartPositionRef]);

  // Update when stopped (for seeks)
  useEffect(() => {
    if (!isPlaying && timeRef.current) {
      timeRef.current.textContent = formatTime(currentTimeRef.current ?? 0, format);
    }
  });

  return (
    <TimeDisplay>
      <span ref={timeRef}>{formatTime(currentTimeRef.current ?? 0, format)}</span> / {formattedDuration}
    </TimeDisplay>
  );
};

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

// Grungy timestamp style for Berlin underground aesthetic
const GrungyTimestamp = styled.div<{ $left: number }>`
  position: absolute;
  left: ${props => props.$left + 4}px;
  font-size: 0.7rem;
  font-family: 'Courier New', monospace;
  font-weight: 700;
  color: #bdc3c7;
  text-shadow:
    1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px -1px 0 rgba(0, 0, 0, 0.3);
  letter-spacing: 0.05em;
  opacity: 0.9;

  &::before {
    content: '//';
    color: #5dade2;
    margin-right: 2px;
    opacity: 0.7;
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
          variant={trackState.muted ? "solid" : "outline"}
          color={trackState.muted ? "red" : "gray"}
          onClick={() => setTrackMute(trackIndex, !trackState.muted)}
          style={{
            flex: 1,
            minWidth: 0,
            // Ensure readable on dark track controls background
            ...(!trackState.muted && { color: 'rgba(255,255,255,0.9)', borderColor: 'rgba(255,255,255,0.4)' })
          }}
        >
          M
        </Button>
        <Button
          size="1"
          variant={trackState.soloed ? "solid" : "outline"}
          color={trackState.soloed ? "amber" : "gray"}
          onClick={() => setTrackSolo(trackIndex, !trackState.soloed)}
          style={{
            flex: 1,
            minWidth: 0,
            // Ensure readable on dark track controls background
            ...(!trackState.soloed && { color: 'rgba(255,255,255,0.9)', borderColor: 'rgba(255,255,255,0.4)' })
          }}
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

// Custom Selection Time Inputs using Radix UI
const CustomSelectionInputs: React.FC = () => {
  const { selectionStart, selectionEnd } = usePlaylistState();
  const { setSelection } = usePlaylistControls();
  const { timeFormat } = usePlaylistData();
  const format = timeFormat as TimeFormat;

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = parseTime(e.target.value, format);
    setSelection(newStart, selectionEnd);
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = parseTime(e.target.value, format);
    setSelection(selectionStart, newEnd);
  };

  return (
    <Flex gap="2" align="center">
      <TextField.Root
        value={formatTime(selectionStart, format)}
        onChange={handleStartChange}
        placeholder="Start"
        size="2"
        style={{ width: '140px' }}
      />
      <Text size="2" color="gray">to</Text>
      <TextField.Root
        value={formatTime(selectionEnd, format)}
        onChange={handleEndChange}
        placeholder="End"
        size="2"
        style={{ width: '140px' }}
      />
    </Flex>
  );
};

// Main Example Content Component - Using individual hooks with Radix UI
const FlexibleApiContent: React.FC = () => {
  const { play, pause, stop, seekTo, setMasterVolume, setTimeFormat, setAutomaticScroll, zoomIn, zoomOut } = usePlaylistControls();
  const { currentTimeRef } = usePlaybackAnimation();
  const { duration, masterVolume, timeFormat } = usePlaylistData();
  const { isAutomaticScroll } = usePlaylistState();
  const format = timeFormat as TimeFormat;

  // Navigation handlers using seekTo
  const handleRewind = () => seekTo(0);
  const handleFastForward = () => seekTo(duration);
  const handleSkipBackward = () => seekTo((currentTimeRef.current ?? 0) - 5);
  const handleSkipForward = () => seekTo((currentTimeRef.current ?? 0) + 5);

  return (
    <Flex direction="column" gap="3">
      {/* Main Transport Controls */}
      <Card>
        <Flex gap="3" align="center" wrap="wrap">
          <Flex gap="2">
            <Button onClick={handleRewind} variant="soft" size="2">
              <CaretDoubleLeftIcon size={16} weight="light" />
              Rewind
            </Button>
            <Button onClick={handleSkipBackward} variant="soft" size="2">
              <SkipBackIcon size={16} weight="light" />
              Skip -5s
            </Button>
            <Button onClick={() => play()} variant="solid" color="green" size="2">
              <PlayIcon size={16} weight="fill" />
              Play
            </Button>
            <Button onClick={() => pause()} variant="soft" color="amber" size="2">
              <PauseIcon size={16} weight="fill" />
              Pause
            </Button>
            <Button onClick={() => stop()} variant="soft" color="red" size="2">
              <StopIcon size={16} weight="fill" />
              Stop
            </Button>
            <Button onClick={handleSkipForward} variant="soft" size="2">
              <SkipForwardIcon size={16} weight="light" />
              Skip +5s
            </Button>
            <Button onClick={handleFastForward} variant="soft" size="2">
              <CaretDoubleRightIcon size={16} weight="light" />
              Fast Forward
            </Button>
          </Flex>
        </Flex>
      </Card>

      {/* Zoom and View Controls */}
      <Card>
        <Flex gap="3" align="center" wrap="wrap">
          <Flex gap="2" align="center">
            <Text size="2" color="gray">Zoom:</Text>
            <Button onClick={zoomIn} size="2" variant="soft">
              <MagnifyingGlassPlusIcon size={16} weight="light" />
              In
            </Button>
            <Button onClick={zoomOut} size="2" variant="soft">
              <MagnifyingGlassMinusIcon size={16} weight="light" />
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
            <SpeakerHighIcon size={16} weight="light" />
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
        renderPlayhead={(props) => <PlayheadWithMarker {...props} />}
        renderTimestamp={(timeMs, pixelPosition) => {
          const seconds = Math.floor(timeMs / 1000);
          const minutes = Math.floor(seconds / 60);
          const secs = seconds % 60;
          const timestamp = `${minutes}:${String(secs).padStart(2, '0')}`;
          return <GrungyTimestamp $left={pixelPosition}>{timestamp}</GrungyTimestamp>;
        }}
        showClipHeaders
      />

      {/* Time Controls Bar */}
      <Card>
        <Flex gap="3" align="center" justify="center" wrap="wrap">
          <AnimatedTimeDisplayComponent duration={duration} format={format} />

          <Separator orientation="vertical" />

          <Flex gap="2" align="center">
            <Text size="2" color="gray">Time Format:</Text>
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

          <Separator orientation="vertical" />

          <Flex gap="2" align="center">
            <Text size="2" color="gray">Selection Range:</Text>
            <CustomSelectionInputs />
          </Flex>
        </Flex>
      </Card>
    </Flex>
  );
};

// Main Example Component
export function FlexibleApiExample() {
  const { theme, isDarkMode: isDark } = useDocusaurusTheme();

  // Custom theme with dark blue/teal aesthetic (matching old flexible-api example)
  const customTheme = {
    ...theme,
    // Normal mode: waveFillColor draws the bars, waveOutlineColor is background
    waveformDrawMode: 'inverted',
    // Waveforms - Dark blue background with light blue bars
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

    // Clip headers - Dark blue-gray with grungy monospace font
    clipHeaderBackgroundColor: 'rgba(44, 62, 80, 0.85)',
    clipHeaderBorderColor: 'rgba(93, 173, 226, 0.4)',
    clipHeaderTextColor: '#ecf0f1',
    clipHeaderFontFamily: '"Courier New", monospace',
    selectedClipHeaderBackgroundColor: 'rgba(52, 152, 219, 0.4)',

    // Timescale
    timeColor: '#ecf0f1',
    timescaleBackgroundColor: '#2c3e50',
  };

  // Albert Kader "Whiptails" minimal techno
  const audioConfigs = React.useMemo(() => [
    {
      src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/01_Loop1.opus',
      name: 'Loop',
    },
    {
      src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/03_Kick.opus',
      name: 'Kick',
    },
    {
      src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/07_Bass1.opus',
      name: 'Bass',
    },
    {
      src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/10_Synth2.opus',
      name: 'Synth',
    },
  ], []);

  const { tracks, loading, error } = useAudioTracks(audioConfigs);

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
          tracks={tracks}
          samplesPerPixel={512}
          mono
          waveHeight={100}
          barGap={0}
          barWidth={1}
          automaticScroll={false}
          controls={{ show: true, width: 120 }}
          theme={customTheme}
          timescale
        >
          <FlexibleApiContent />
        </WaveformPlaylistProvider>

        <Card style={{ marginTop: '2rem', background: 'var(--gray-2)' }}>
          <Flex direction="column" gap="2">
            <Text size="3" weight="bold"><LightbulbIcon size={18} weight="light" style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} /> About This Example</Text>
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
              <li><Text size="2" color="gray"><code>useTimeFormat()</code> - Get <code>formatTime</code> and <code>parseTime</code> for time display/input</Text></li>
              <li><Text size="2" color="gray"><code>renderPlayhead</code> - Custom playhead with triangle marker (see <code>PlayheadWithMarker</code>)</Text></li>
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
