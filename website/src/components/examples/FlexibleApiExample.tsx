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

import React, { useRef, useEffect, useState } from 'react';
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
  LightbulbIcon,
  ArrowsClockwiseIcon
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
  usePlaybackShortcuts,
  useClipSplitting,
  useClipDragHandlers,
  useDragSensors,
  type TimeFormat,
  type ClipTrack,
} from '@waveform-playlist/browser';
import { DndContext } from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
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

// Styled components for custom track controls - compact horizontal layout
const TrackControlsContainer = styled.div`
  padding: 0.25rem 0.4rem;
  background: linear-gradient(135deg, #2c3e50 0%, #1a252f 100%);
  color: white;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
  width: 160px;
  height: ${60 + CLIP_HEADER_HEIGHT}px;
  box-sizing: border-box;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;

  &:hover {
    background: linear-gradient(135deg, #34495e 0%, #1f2d3a 100%);
  }
`;

const TrackTitle = styled.span`
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 45px;
  max-width: 50px;
`;

const TrackButtonsRow = styled.div`
  display: flex;
  gap: 0.2rem;
`;

const VolumeSliderContainer = styled.div`
  flex: 1;
  min-width: 40px;
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

// Custom Track Controls Component - compact horizontal layout
const CustomTrackControls: React.FC<{ trackIndex: number }> = ({ trackIndex }) => {
  const { trackStates } = usePlaylistData();
  const { setTrackMute, setTrackSolo, setTrackVolume } = usePlaylistControls();
  const trackState = trackStates[trackIndex];

  if (!trackState) return null;

  const trackName = trackState.name || `Track ${trackIndex + 1}`;

  return (
    <TrackControlsContainer>
      <TrackTitle title={trackName}>{trackName}</TrackTitle>
      <TrackButtonsRow>
        <Button
          size="1"
          variant={trackState.muted ? "solid" : "outline"}
          color={trackState.muted ? "red" : "gray"}
          onClick={() => setTrackMute(trackIndex, !trackState.muted)}
          style={{
            padding: '0 0.4rem',
            minWidth: 0,
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
            padding: '0 0.4rem',
            minWidth: 0,
            ...(!trackState.soloed && { color: 'rgba(255,255,255,0.9)', borderColor: 'rgba(255,255,255,0.4)' })
          }}
        >
          S
        </Button>
      </TrackButtonsRow>
      <VolumeSliderContainer>
        <Slider
          value={[trackState.volume * 100]}
          onValueChange={([v]) => setTrackVolume(trackIndex, v / 100)}
          min={0}
          max={100}
          step={1}
          size="1"
        />
      </VolumeSliderContainer>
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

interface FlexibleApiContentProps {
  tracks: ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
}

// Main Example Content Component - Using individual hooks with Radix UI
const FlexibleApiContent: React.FC<FlexibleApiContentProps> = ({ tracks, onTracksChange }) => {
  const { play, pause, stop, seekTo, setMasterVolume, setTimeFormat, setAutomaticScroll, setLoopEnabled, setLoopRegion, zoomIn, zoomOut } = usePlaylistControls();
  const { currentTimeRef } = usePlaybackAnimation();
  const { duration, masterVolume, timeFormat, sampleRate, samplesPerPixel, playoutRef, isDraggingRef } = usePlaylistData();
  const { isAutomaticScroll, selectionStart, selectionEnd, isLoopEnabled, loopStart, loopEnd } = usePlaylistState();
  const format = timeFormat as TimeFormat;

  // Setup drag sensors and handlers for clip movement/trimming
  const sensors = useDragSensors();
  const { onDragStart, onDragMove, onDragEnd, onDragCancel, collisionModifier } = useClipDragHandlers({
    tracks,
    onTracksChange,
    samplesPerPixel,
    sampleRate,
    engineRef: playoutRef,
    isDraggingRef,
  });

  // Enable clip splitting
  const { splitClipAtPlayhead } = useClipSplitting({
    tracks,
    sampleRate,
    samplesPerPixel,
    engineRef: playoutRef,
  });

  // Enable keyboard shortcuts (Space=play/pause, Escape=stop, 0=rewind, S=split)
  usePlaybackShortcuts({
    additionalShortcuts: [
      {
        key: 's',
        action: splitClipAtPlayhead,
        description: 'Split clip at playhead',
        preventDefault: true,
      },
    ],
  });

  // Navigation handlers using seekTo
  const handleRewind = () => seekTo(0);
  const handleFastForward = () => seekTo(duration);
  const handleSkipBackward = () => seekTo((currentTimeRef.current ?? 0) - 5);
  const handleSkipForward = () => seekTo((currentTimeRef.current ?? 0) + 5);

  // Play handler that respects selection
  const handlePlay = async () => {
    if (selectionStart !== selectionEnd && selectionEnd > selectionStart) {
      // Play only the selected region
      const selectionDuration = selectionEnd - selectionStart;
      await play(selectionStart, selectionDuration);
    } else {
      // Play from current position to the end
      await play(currentTimeRef.current ?? 0);
    }
  };

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
            <Button onClick={handlePlay} variant="solid" color="green" size="2">
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
            <Button
              onClick={() => {
                if (!isLoopEnabled && loopStart === loopEnd) {
                  // Create a default loop region when enabling loop without one
                  const defaultEnd = Math.min(10, duration * 0.25);
                  setLoopRegion(0, Math.max(1, defaultEnd));
                }
                setLoopEnabled(!isLoopEnabled);
              }}
              variant={isLoopEnabled ? "solid" : "soft"}
              color={isLoopEnabled ? "green" : "gray"}
              size="2"
              title={isLoopEnabled ? 'Disable loop' : 'Enable loop'}
            >
              <ArrowsClockwiseIcon size={16} weight={isLoopEnabled ? "fill" : "light"} />
              {isLoopEnabled ? 'Loop On' : 'Loop Off'}
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

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        modifiers={[restrictToHorizontalAxis, collisionModifier]}
      >
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
          interactiveClips
        />
      </DndContext>

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
    waveformDrawMode: 'inverted' as const,
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

  // Albert Kader "Ubiquitous" - all 11 tracks
  const audioConfigs = React.useMemo(() => [
    { src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/01_Kick.opus', name: 'Kick' },
    { src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/02_HiHat1.opus', name: 'HiHat 1' },
    { src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/03_HiHat2.opus', name: 'HiHat 2' },
    { src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/04_Claps.opus', name: 'Claps' },
    { src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/05_SFX1.opus', name: 'SFX 1' },
    { src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/06_SFX2.opus', name: 'SFX 2' },
    { src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/07_Shakers.opus', name: 'Shakers' },
    { src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/08_Bass.opus', name: 'Bass' },
    { src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.opus', name: 'Synth 1' },
    { src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/10_Synth2_PitchModulated.opus', name: 'Synth 2 Mod' },
    { src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/11_Synth2.opus', name: 'Synth 2' },
  ], []);

  // Load audio tracks PROGRESSIVELY - tracks appear as they load!
  const { tracks: loadedTracks, loading, error, loadedCount, totalCount } = useAudioTracks(audioConfigs, { progressive: true });
  const [tracks, setTracks] = useState<ClipTrack[]>([]);

  // Update tracks state as they load progressively
  useEffect(() => {
    if (loadedTracks.length > 0) {
      setTracks(loadedTracks);
    }
  }, [loadedTracks]);

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

  // Show loading progress while tracks are being loaded
  if (tracks.length === 0 && loading) {
    return (
      <Theme appearance={isDark ? 'dark' : 'light'} accentColor="blue" grayColor="slate" radius="medium">
        <Container>
          <Card>
            <Flex justify="center" align="center" style={{ padding: '3rem' }}>
              <Text size="3">Loading tracks: {loadedCount}/{totalCount}...</Text>
            </Flex>
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
          onTracksChange={setTracks}
          samplesPerPixel={512}
          mono
          waveHeight={40}
          barGap={0}
          barWidth={1}
          automaticScroll
          controls={{ show: true, width: 160 }}
          theme={customTheme}
          timescale
        >
          <FlexibleApiContent tracks={tracks} onTracksChange={setTracks} />
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

        <Card style={{ marginTop: '1rem', background: 'var(--gray-2)' }}>
          <Flex direction="column" gap="2">
            <Text size="3" weight="bold">⌨️ Keyboard Shortcuts</Text>
            <Flex gap="4" wrap="wrap">
              <Flex direction="column" gap="1">
                <Text size="2" weight="bold" color="gray">Playback</Text>
                <Text size="2" color="gray"><code>Space</code> — Play / Pause</Text>
                <Text size="2" color="gray"><code>Escape</code> — Stop</Text>
                <Text size="2" color="gray"><code>0</code> — Rewind to start</Text>
                <Text size="2" color="gray"><strong>Loop</strong> — Toggle loop for selection</Text>
              </Flex>
              <Flex direction="column" gap="1">
                <Text size="2" weight="bold" color="gray">Editing</Text>
                <Text size="2" color="gray"><code>S</code> — Split clip at playhead</Text>
              </Flex>
              <Flex direction="column" gap="1">
                <Text size="2" weight="bold" color="gray">Clip Interactions</Text>
                <Text size="2" color="gray"><strong>Drag clip header</strong> — Move clip along timeline</Text>
                <Text size="2" color="gray"><strong>Drag clip edges</strong> — Trim clip boundaries</Text>
                <Text size="2" color="gray"><strong>Click waveform</strong> — Position playhead</Text>
              </Flex>
            </Flex>
          </Flex>
        </Card>
      </Container>
    </Theme>
  );
}
