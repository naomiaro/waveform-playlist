import React, { useRef, useState, ReactNode } from 'react';
import { ThemeProvider } from 'styled-components';
import {
  Playlist,
  Track as TrackComponent,
  SmartChannel,
  Playhead,
  Selection,
  PlaylistInfoContext,
  TrackControlsContext,
  DevicePixelRatioProvider,
  StyledTimeScale,
  secondsToPixels,
  Controls,
  Header,
  Button,
  ButtonGroup,
  Slider,
  SliderWrapper,
  VolumeDownIcon,
  VolumeUpIcon,
} from '@waveform-playlist/ui-components';
import { useWaveformPlaylist } from '../WaveformPlaylistContext';
import type { Peaks } from '@waveform-playlist/webaudio-peaks';

// Default theme
const defaultTheme = {
  waveOutlineColor: '#005BBB',
  waveFillColor: '#FFD500',
  waveProgressColor: '#ff0000',
  timeColor: '#000',
};

export interface WaveformProps {
  theme?: {
    waveOutlineColor?: string;
    waveFillColor?: string;
    waveProgressColor?: string;
    timeColor?: string;
  };
  timescale?: boolean;
  renderTrackControls?: (trackIndex: number) => ReactNode;
  className?: string;
}

/**
 * Waveform visualization component that uses the playlist context
 */
export const Waveform: React.FC<WaveformProps> = ({
  theme: userTheme,
  timescale = true,
  renderTrackControls,
  className,
}) => {
  const {
    audioBuffers,
    peaksDataArray,
    trackStates,
    isPlaying,
    currentTime,
    duration,
    selectionStart,
    selectionEnd,
    samplesPerPixel,
    sampleRate,
    waveHeight,
    timeScaleHeight,
    controls,
    setTrackMute,
    setTrackSolo,
    setTrackVolume,
    setTrackPan,
    setSelection,
    play,
    playoutRef,
    currentTimeRef,
    setScrollContainer,
  } = useWaveformPlaylist();

  const [isSelecting, setIsSelecting] = useState(false);

  const theme = { ...defaultTheme, ...userTheme };

  // Calculate dimensions
  const tracksFullWidth = audioBuffers.length > 0
    ? Math.floor((duration * sampleRate) / samplesPerPixel)
    : 0;

  // Mouse handlers for selection and click-to-seek
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const controlWidth = controls.show ? controls.width : 0;
    const x = e.clientX - rect.left - controlWidth;
    const clickTime = (x * samplesPerPixel) / sampleRate;

    setIsSelecting(true);
    currentTimeRef.current = clickTime;
    setSelection(clickTime, clickTime);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const controlWidth = controls.show ? controls.width : 0;
    const x = e.clientX - rect.left - controlWidth;
    const moveTime = (x * samplesPerPixel) / sampleRate;

    const start = Math.min(selectionStart, moveTime);
    const end = Math.max(selectionStart, moveTime);
    setSelection(start, end);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting) return;

    setIsSelecting(false);

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const controlWidth = controls.show ? controls.width : 0;
    const x = e.clientX - rect.left - controlWidth;
    const endTime = (x * samplesPerPixel) / sampleRate;

    const start = Math.min(selectionStart, endTime);
    const end = Math.max(selectionStart, endTime);

    // If it's just a click (not a drag), seek to that position
    if (Math.abs(end - start) < 0.1) {
      currentTimeRef.current = start;

      if (isPlaying && playoutRef.current) {
        playoutRef.current.stop();
        play(start);
      } else if (playoutRef.current) {
        playoutRef.current.stop();
      }
    } else {
      // It was a drag - finalize the selection
      setSelection(start, end);
    }
  };

  if (audioBuffers.length === 0 || peaksDataArray.length === 0) {
    return <div className={className}>Loading waveform...</div>;
  }

  return (
    <DevicePixelRatioProvider>
      <ThemeProvider theme={theme}>
        <PlaylistInfoContext.Provider
          value={{
            samplesPerPixel,
            sampleRate,
            zoomLevels: [samplesPerPixel],
            waveHeight,
            timeScaleHeight,
            duration,
            controls,
          }}
        >
          <Playlist
            theme={theme}
            backgroundColor={theme.waveOutlineColor}
            scrollContainerWidth={tracksFullWidth}
            timescaleWidth={tracksFullWidth}
            tracksWidth={tracksFullWidth}
            controlsWidth={controls.show ? controls.width : 0}
            onTracksMouseDown={handleMouseDown}
            onTracksMouseMove={handleMouseMove}
            onTracksMouseUp={handleMouseUp}
            scrollContainerRef={setScrollContainer}
            timescale={
              timescale ? (
                <StyledTimeScale
                  duration={duration * 1000}
                  marker={10000}
                  bigStep={5000}
                  secondStep={1000}
                />
              ) : undefined
            }
            className={className}
          >
            <>
              {peaksDataArray.map((peaksData, trackIndex) => {
                const width = peaksData.length;
                const trackState = trackStates[trackIndex] || {
                  muted: false,
                  soloed: false,
                  volume: 1.0,
                  pan: 0,
                };

                // Default track controls if not custom renderer provided
                const trackControls = renderTrackControls ? (
                  renderTrackControls(trackIndex)
                ) : (
                  <Controls>
                    <Header style={{ justifyContent: 'center' }}>
                      Track {trackIndex + 1}
                    </Header>
                    <ButtonGroup>
                      <Button
                        $variant={trackState.muted ? 'danger' : 'outline'}
                        onClick={() => setTrackMute(trackIndex, !trackState.muted)}
                      >
                        Mute
                      </Button>
                      <Button
                        $variant={trackState.soloed ? 'info' : 'outline'}
                        onClick={() => setTrackSolo(trackIndex, !trackState.soloed)}
                      >
                        Solo
                      </Button>
                    </ButtonGroup>
                    <SliderWrapper>
                      <VolumeDownIcon />
                      <Slider
                        min="0"
                        max="1"
                        step="0.01"
                        value={trackState.volume}
                        onChange={(e) =>
                          setTrackVolume(trackIndex, parseFloat(e.target.value))
                        }
                      />
                      <VolumeUpIcon />
                    </SliderWrapper>
                    <SliderWrapper>
                      <span>L</span>
                      <Slider
                        min="-1"
                        max="1"
                        step="0.01"
                        value={trackState.pan}
                        onChange={(e) =>
                          setTrackPan(trackIndex, parseFloat(e.target.value))
                        }
                      />
                      <span>R</span>
                    </SliderWrapper>
                  </Controls>
                );

                return (
                  <TrackControlsContext.Provider key={trackIndex} value={trackControls}>
                    <TrackComponent
                      numChannels={peaksData.data.length}
                      backgroundColor={theme.waveOutlineColor}
                      offset={0}
                      width={tracksFullWidth}
                    >
                      {peaksData.data.map((channelPeaks: Peaks, channelIndex: number) => (
                        <SmartChannel
                          key={`${trackIndex}-${channelIndex}`}
                          index={channelIndex}
                          data={channelPeaks}
                          bits={peaksData.bits}
                          length={width}
                          progress={0}
                        />
                      ))}
                    </TrackComponent>
                  </TrackControlsContext.Provider>
                );
              })}
              {selectionStart !== selectionEnd && (
                <Selection
                  startPosition={
                    (Math.min(selectionStart, selectionEnd) * sampleRate) / samplesPerPixel +
                    (controls.show ? controls.width : 0)
                  }
                  endPosition={
                    (Math.max(selectionStart, selectionEnd) * sampleRate) / samplesPerPixel +
                    (controls.show ? controls.width : 0)
                  }
                  color="rgba(0, 255, 0, 0.3)"
                />
              )}
              {(isPlaying || selectionStart === selectionEnd) && (
                <Playhead
                  position={
                    (currentTime * sampleRate) / samplesPerPixel +
                    (controls.show ? controls.width : 0)
                  }
                  color="#f00"
                />
              )}
            </>
          </Playlist>
        </PlaylistInfoContext.Provider>
      </ThemeProvider>
    </DevicePixelRatioProvider>
  );
};
