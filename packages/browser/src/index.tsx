import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ThemeProvider } from 'styled-components';
import { TonePlayout } from '@waveform-playlist/playout';
import { LoaderFactory } from '@waveform-playlist/loaders';
import { Track } from '@waveform-playlist/core';
import { getContext } from 'tone';
import {
  Channel,
  Button,
  ButtonGroup,
  Controls,
  Header,
  VolumeDownIcon,
  VolumeUpIcon,
  Slider,
  SliderWrapper,
  Knob,
  StyledTimeScale,
  Playlist,
  Playhead,
  Track as TrackComponent,
  PlaylistInfoContext,
  DevicePixelRatioProvider,
  TrackControlsContext,
  PlayoutProvider,
  usePlayoutStatus,
  usePlayoutStatusUpdate,
  secondsToPixels,
} from '@waveform-playlist/ui-components';
import { generatePeaks } from './peaksUtil';
import type { PeakData, Peaks } from '@waveform-playlist/webaudio-peaks';

// Simple theme
const defaultTheme = {
  waveOutlineColor: '#00f',
  waveFillColor: '#0ff',
  waveProgressColor: '#f00',
  timeColor: '#000',
};

interface PlaylistConfig {
  container: HTMLElement;
  samplesPerPixel?: number;
  waveHeight?: number;
  colors?: {
    waveOutlineColor?: string;
    waveFillColor?: string;
    waveProgressColor?: string;
    timeColor?: string;
  };
  controls?: {
    show?: boolean;
    width?: number;
  };
  zoomLevels?: number[];
  state?: string;
  timescale?: boolean;
  isAutomaticScroll?: boolean;
}

interface TrackConfig {
  src: string | File;
  name?: string;
  start?: number;
  fadeIn?: {
    duration: number;
    shape?: 'logarithmic' | 'linear' | 'sCurve' | 'exponential';
  };
  fadeOut?: {
    duration: number;
    shape?: 'logarithmic' | 'linear' | 'sCurve' | 'exponential';
  };
  gain?: number;
  muted?: boolean;
  soloed?: boolean;
  stereoPan?: number;
}

class WaveformPlaylistClass {
  private container: HTMLElement;
  private root: Root | null = null;
  private playout: TonePlayout | null = null;
  private config: PlaylistConfig;
  private tracks: Track[] = [];
  private peaksData: Map<string, PeakData> = new Map();
  private eventEmitter: any = null;
  private playbackState: 'stopped' | 'paused' | 'playing' = 'stopped';
  private currentTime: number = 0;
  private animationFrameId: number | null = null;
  private setProgressFn: ((progress: number) => void) | null = null;
  private isAutomaticScroll: boolean = false;
  private scrollContainer: HTMLElement | null = null;

  constructor(config: PlaylistConfig) {
    this.container = config.container;
    this.config = config;
    this.isAutomaticScroll = config.isAutomaticScroll ?? false;

    // Clear container
    this.container.innerHTML = '';

    // Create React root
    this.root = createRoot(this.container);

    // Initialize playout
    this.playout = new TonePlayout();

    // Initialize event emitter
    this.eventEmitter = this.createEventEmitter();
  }

  async load(trackConfigs: TrackConfig[]): Promise<void> {
    // Use Tone's context (it will be in suspended state until user gesture)
    const audioContext = getContext().rawContext as AudioContext;
    const loadedTracks: Track[] = [];

    // Load all tracks
    for (let i = 0; i < trackConfigs.length; i++) {
      const config = trackConfigs[i];

      try {
        // Load audio file
        const loader = LoaderFactory.createLoader(config.src, audioContext);
        const audioBuffer = await loader.load();

        // Create track object
        const track: Track = {
          id: `track-${i}`,
          name: config.name || `Track ${i + 1}`,
          src: config.src,
          gain: config.gain ?? 1,
          muted: config.muted ?? false,
          soloed: config.soloed ?? false,
          stereoPan: config.stereoPan ?? 0,
          startTime: config.start ?? 0,
          fadeIn: config.fadeIn ? {
            start: config.start ?? 0,
            end: (config.start ?? 0) + config.fadeIn.duration,
            type: config.fadeIn.shape ?? 'logarithmic',
          } : undefined,
          fadeOut: config.fadeOut ? {
            start: audioBuffer.duration - config.fadeOut.duration,
            end: audioBuffer.duration,
            type: config.fadeOut.shape ?? 'logarithmic',
          } : undefined,
        };

        loadedTracks.push(track);

        // Generate peaks for waveform visualization
        const samplesPerPixel = this.config.samplesPerPixel || 4096;
        const peaks = generatePeaks(audioBuffer, samplesPerPixel);
        this.peaksData.set(track.id, peaks);

        // Add to playout engine
        if (this.playout) {
          this.playout.addTrack({
            buffer: audioBuffer,
            track,
          });
        }
      } catch (error) {
        console.error(`Failed to load track ${config.src}:`, error);
        throw error;
      }
    }

    this.tracks = loadedTracks;

    console.log('Loaded tracks:', loadedTracks);
    console.log('Peaks data:', Array.from(this.peaksData.entries()));

    // Don't initialize playout here - it will be initialized on first play()
    // to comply with browser autoplay policies

    // Render the playlist (for now, just a simple div with track info)
    this.render();
    console.log('Render complete');
  }

  async addTrack(src: string | File, config?: Partial<TrackConfig>): Promise<void> {
    // Use Tone's context
    const audioContext = getContext().rawContext as AudioContext;

    try {
      // Create track config
      const trackConfig: TrackConfig = {
        src,
        name: config?.name,
        start: config?.start,
        fadeIn: config?.fadeIn,
        fadeOut: config?.fadeOut,
        gain: config?.gain,
        muted: config?.muted,
        soloed: config?.soloed,
        stereoPan: config?.stereoPan,
      };

      // Load audio file
      const loader = LoaderFactory.createLoader(trackConfig.src, audioContext);
      const audioBuffer = await loader.load();

      // Create track object with new ID based on current tracks length
      const trackIndex = this.tracks.length;
      const track: Track = {
        id: `track-${trackIndex}`,
        name: trackConfig.name || (src instanceof File ? src.name : `Track ${trackIndex + 1}`),
        src: trackConfig.src,
        gain: trackConfig.gain ?? 1,
        muted: trackConfig.muted ?? false,
        soloed: trackConfig.soloed ?? false,
        stereoPan: trackConfig.stereoPan ?? 0,
        startTime: trackConfig.start ?? 0,
        fadeIn: trackConfig.fadeIn ? {
          start: trackConfig.start ?? 0,
          end: (trackConfig.start ?? 0) + trackConfig.fadeIn.duration,
          type: trackConfig.fadeIn.shape ?? 'logarithmic',
        } : undefined,
        fadeOut: trackConfig.fadeOut ? {
          start: audioBuffer.duration - trackConfig.fadeOut.duration,
          end: audioBuffer.duration,
          type: trackConfig.fadeOut.shape ?? 'logarithmic',
        } : undefined,
      };

      // Generate peaks for waveform visualization
      const samplesPerPixel = this.config.samplesPerPixel || 4096;
      const peaks = generatePeaks(audioBuffer, samplesPerPixel);
      this.peaksData.set(track.id, peaks);

      // Add to playout engine
      if (this.playout) {
        this.playout.addTrack({
          buffer: audioBuffer,
          track,
        });
      }

      // Add to tracks array
      this.tracks.push(track);

      // Re-render to show the new track
      this.render();

      console.log('Added new track:', track);
    } catch (error) {
      console.error(`Failed to load track:`, error);
      throw error;
    }
  }

  private render(): void {
    if (!this.root) return;

    const theme = {
      ...defaultTheme,
      ...this.config.colors,
    };

    const waveHeight = this.config.waveHeight || 128;
    const samplesPerPixel = this.config.samplesPerPixel || 4096;
    const timeScaleHeight = 30;

    // Move the playlist content into a separate component
    const PlaylistContent: React.FC = () => {
      const { progress: currentTime } = usePlayoutStatus();
      const { setProgress } = usePlayoutStatusUpdate();
      const animationRef = React.useRef<number | null>(null);

      // Store setProgress reference for use in animation and seeking
      React.useEffect(() => {
        this.setProgressFn = setProgress;
        return () => {
          this.setProgressFn = null;
        };
      }, [setProgress]);

    // Check if controls should be shown (default: true)
    const showControls = this.config.controls?.show !== false;
    const controlsWidth = this.config.controls?.width || 250;

    // Check if timescale should be shown (default: true)
    const showTimescale = this.config.timescale !== false;

    // Calculate total duration from all tracks
    let maxDuration = 0;
    if (this.playout) {
      this.tracks.forEach((track) => {
        const toneTrack = this.playout?.getTrack(track.id);
        if (toneTrack) {
          const trackDuration = toneTrack.buffer.duration + track.startTime;
          maxDuration = Math.max(maxDuration, trackDuration);
        }
      });
    }

    // Playlist info context values
    const playlistInfo = {
      sampleRate: this.playout?.sampleRate || 44100,
      samplesPerPixel,
      zoomLevels: this.config.zoomLevels || [512, 1024, 2048, 4096],
      waveHeight,
      timeScaleHeight,
      duration: maxDuration,
      controls: {
        show: showControls,
        width: controlsWidth,
      },
    };

    // Waveform component using Channel from ui-components - memoize to prevent recreation
    const WaveformDisplay = React.useMemo(() => {
      return React.memo<{ trackId: string; currentTime: number }>(({ trackId, currentTime }) => {
      const peaksData = this.peaksData.get(trackId);
      if (!peaksData || !this.playout) return null;

      const track = this.playout.getTrack(trackId);
      if (!track) return null;

      const width = peaksData.length;

      // Calculate progress in pixels for this track
      const trackData = this.tracks.find(t => t.id === trackId);
      const trackStartTime = trackData?.startTime || 0;
      const trackDuration = track.buffer.duration;

      // Calculate progress based on how long this track has been playing
      let progressPx = 0;
      if (currentTime >= trackStartTime) {
        const relativeTime = currentTime - trackStartTime;
        if (relativeTime <= trackDuration) {
          // Track is currently playing - show progress based on relativeTime
          progressPx = secondsToPixels(relativeTime, samplesPerPixel, this.playout.sampleRate);
        } else {
          // Track has finished - show full width
          progressPx = secondsToPixels(trackDuration, samplesPerPixel, this.playout.sampleRate);
        }
        progressPx = Math.min(progressPx, width); // Clamp to width
      }

      return (
        <>
          {peaksData.data.map((channelData: Peaks, index: number) => (
            <Channel
              key={index}
              index={index}
              data={channelData}
              bits={peaksData.bits}
              length={width}
              waveHeight={waveHeight}
              waveOutlineColor={theme.waveOutlineColor || '#00f'}
              waveFillColor={theme.waveFillColor || '#f0f0f0'}
              waveProgressColor={theme.waveProgressColor || '#f00'}
              progress={progressPx}
            />
          ))}
        </>
      );
      });
    }, [theme, waveHeight, samplesPerPixel]);

    const TrackControls = React.useMemo(() => {
      return ({ trackId, track }: { trackId: string; track: Track }) => {
      const [muted, setMuted] = React.useState(track.muted);
      const [soloed, setSoloed] = React.useState(track.soloed);
      const [gain, setGain] = React.useState(track.gain);
      const [stereoPan, setStereoPan] = React.useState(track.stereoPan || 0);

      return (
        <Controls>
          <div style={{ fontSize: '9px', fontWeight: 'bold', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
            {track.name}
          </div>
          <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
            <Button
              onClick={() => {
                const newMuted = !muted;
                setMuted(newMuted);
                this.setTrackMute(trackId, newMuted);
              }}
              style={{
                padding: '2px 5px',
                fontSize: '9px',
                backgroundColor: muted ? '#ef4444' : undefined,
                color: muted ? '#fff' : undefined,
              }}
            >
              Mute
            </Button>
            <Button
              onClick={() => {
                const newSoloed = !soloed;
                setSoloed(newSoloed);
                this.setTrackSolo(trackId, newSoloed);
              }}
              style={{
                padding: '2px 5px',
                fontSize: '9px',
                backgroundColor: soloed ? '#3b82f6' : undefined,
                color: soloed ? '#fff' : undefined,
              }}
            >
              Solo
            </Button>
          </div>
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px' }}>
            <VolumeDownIcon style={{ fontSize: '10px', flexShrink: 0 }} />
            <Slider
              min={0}
              max={200}
              value={gain * 100}
              onChange={(e) => {
                const newGain = parseInt(e.currentTarget.value) / 100;
                setGain(newGain);
                this.setTrackGain(trackId, newGain);
              }}
              style={{ flex: 1 }}
            />
            <VolumeUpIcon style={{ fontSize: '10px', flexShrink: 0 }} />
          </div>
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px' }}>
            <span style={{ fontSize: '8px', color: '#666', fontWeight: 'bold', flexShrink: 0 }}>L</span>
            <Slider
              min={-100}
              max={100}
              value={stereoPan * 100}
              onChange={(e) => {
                const newPan = parseInt(e.currentTarget.value) / 100;
                setStereoPan(newPan);
                this.setTrackPan(trackId, newPan);
              }}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: '8px', color: '#666', fontWeight: 'bold', flexShrink: 0 }}>R</span>
          </div>
        </Controls>
      );
      };
    }, []);

    // Calculate timeline width for the timescale
    const timelineWidth = this.playout
      ? secondsToPixels(maxDuration, samplesPerPixel, this.playout.sampleRate) + (showControls ? controlsWidth : 0)
      : 0;

    return (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={playlistInfo}>
          <ThemeProvider theme={theme}>
            <div style={{ fontFamily: 'Arial, sans-serif' }}>
              <Playlist
                theme={theme}
                backgroundColor={theme.waveOutlineColor || '#00f'}
                timescaleWidth={timelineWidth}
                timescale={
                  showTimescale ? (
                    <StyledTimeScale
                      duration={maxDuration * 1000}
                      marker={10000}
                      bigStep={5000}
                      secondStep={1000}
                    />
                  ) : undefined
                }
              >
                <>
                  {this.tracks.map((track) => {
                    const peaksData = this.peaksData.get(track.id);
                    if (!peaksData) return null;

                    const trackControls = showControls ? (
                      <TrackControls trackId={track.id} track={track} />
                    ) : <></>;

                    return (
                      <TrackControlsContext.Provider key={track.id} value={trackControls}>
                        <TrackComponent
                          numChannels={peaksData.data.length}
                          backgroundColor={theme.waveOutlineColor || '#00f'}
                        >
                          <WaveformDisplay trackId={track.id} currentTime={currentTime} />
                        </TrackComponent>
                      </TrackControlsContext.Provider>
                    );
                  })}
                  {this.tracks.length > 0 && (
                    <Playhead
                      position={secondsToPixels(currentTime, samplesPerPixel, this.playout.sampleRate) + (showControls ? controlsWidth : 0)}
                      color={theme.waveProgressColor || '#f00'}
                    />
                  )}
                </>
              </Playlist>
              <div style={{ marginTop: '20px', color: '#666', fontSize: '12px', textAlign: 'center' }}>
                ✨ Powered by Tone.js 15.1.22 and React 18
              </div>
            </div>
          </ThemeProvider>
        </PlaylistInfoContext.Provider>
      </DevicePixelRatioProvider>
      );
    };

    // Render with PlayoutProvider wrapping everything
    this.root.render(
      <PlayoutProvider>
        <PlaylistContent />
      </PlayoutProvider>
    );
  }

  async play(startTime?: number): Promise<void> {
    if (this.playout) {
      // Initialize playout on first play (requires user gesture)
      await this.playout.init();

      // If resuming from pause, don't pass offset (to resume from current position)
      // If stopped or explicit startTime provided, use that offset
      if (this.playbackState === 'paused' && startTime === undefined) {
        this.playout.play(undefined, undefined);
      } else {
        this.playout.play(undefined, startTime ?? 0);
      }

      this.playbackState = 'playing';
      this.startAnimation();
    }
  }

  pause(): void {
    if (this.playout) {
      this.playout.pause();
      this.playbackState = 'paused';
      this.stopAnimation();
    }
  }

  stop(): void {
    if (this.playout) {
      this.playout.stop();
      this.playbackState = 'stopped';
      this.stopAnimation();
      this.currentTime = 0;
      if (this.setProgressFn) {
        this.setProgressFn(0);
      }
      // Emit timeupdate event for external listeners
      if (this.eventEmitter) {
        this.eventEmitter.emit('timeupdate', 0);
      }
      // Scroll back to the beginning
      if (this.scrollContainer) {
        this.scrollContainer.scrollLeft = 0;
      }
    }
  }

  private startAnimation(): void {
    if (this.animationFrameId !== null) {
      return; // Already running
    }

    const updateProgress = () => {
      // Only continue loop if still playing
      if (this.playbackState !== 'playing' || !this.playout) {
        this.animationFrameId = null;
        return;
      }

      this.currentTime = this.playout.getCurrentTime();

      // Check if playback has reached the end
      const duration = this.getDuration();
      if (this.currentTime >= duration) {
        this.stop();
        return;
      }

      if (this.setProgressFn) {
        this.setProgressFn(this.currentTime);
      }
      // Emit timeupdate event for external listeners
      if (this.eventEmitter) {
        this.eventEmitter.emit('timeupdate', this.currentTime);
      }

      // Handle automatic scroll
      if (this.isAutomaticScroll) {
        this.scrollToCurrentTime();
      }

      this.animationFrameId = requestAnimationFrame(updateProgress);
    };

    // Only start if actually playing
    if (this.playbackState === 'playing') {
      this.animationFrameId = requestAnimationFrame(updateProgress);
    }
  }

  private scrollToCurrentTime(): void {
    if (!this.scrollContainer) {
      // Try to find the scroll container using data attribute
      this.scrollContainer = this.container.querySelector('[data-scroll-container="true"]') as HTMLElement;
      if (!this.scrollContainer) {
        return;
      }
    }

    if (!this.playout) return;

    // Convert current time to pixels using shared util
    const samplesPerPixel = this.config.samplesPerPixel || 4096;
    const currentPixel = secondsToPixels(this.currentTime, samplesPerPixel, this.playout.sampleRate);

    const viewportWidth = this.scrollContainer.clientWidth;
    const currentScrollLeft = this.scrollContainer.scrollLeft;
    const currentScrollRight = currentScrollLeft + viewportWidth;

    // Define playhead position in viewport (20% from left edge)
    const playheadOffset = viewportWidth * 0.2;

    // Check if playhead is outside the visible area
    const isOutsideLeft = currentPixel < currentScrollLeft;
    const isOutsideRight = currentPixel > currentScrollRight;

    if (isOutsideLeft || isOutsideRight) {
      // Position playhead at the left edge (with small offset)
      this.scrollContainer.scrollLeft = Math.max(0, currentPixel - playheadOffset);
    } else {
      // Scroll to keep playhead at consistent position (20% from left)
      const targetScrollLeft = currentPixel - playheadOffset;
      if (targetScrollLeft > currentScrollLeft) {
        this.scrollContainer.scrollLeft = Math.max(0, targetScrollLeft);
      }
    }
  }

  setAutomaticScroll(enabled: boolean): void {
    this.isAutomaticScroll = enabled;
  }

  private stopAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  setMasterGain(gain: number): void {
    if (this.playout) {
      this.playout.setMasterGain(gain);
    }
  }

  setTrackGain(trackId: string, gain: number): void {
    if (this.playout) {
      const track = this.playout.getTrack(trackId);
      if (track) {
        track.setVolume(gain);
      }
    }
  }

  setTrackMute(trackId: string, muted: boolean): void {
    if (this.playout) {
      this.playout.setMute(trackId, muted);
    }
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    if (this.playout) {
      this.playout.setSolo(trackId, soloed);
    }
  }

  setTrackPan(trackId: string, pan: number): void {
    if (this.playout) {
      const track = this.playout.getTrack(trackId);
      if (track) {
        track.setPan(pan);
      }
    }
  }

  private getDuration(): number {
    let maxDuration = 0;
    if (this.playout) {
      this.tracks.forEach((track) => {
        const toneTrack = this.playout?.getTrack(track.id);
        if (toneTrack) {
          const trackDuration = toneTrack.buffer.duration + track.startTime;
          maxDuration = Math.max(maxDuration, trackDuration);
        }
      });
    }
    return maxDuration;
  }

  rewind(): void {
    const wasPlaying = this.playbackState === 'playing';
    if (wasPlaying) {
      this.stop();
      this.play(0);
    } else {
      this.currentTime = 0;
      if (this.setProgressFn) {
        this.setProgressFn(0);
      }
      // Emit timeupdate event for external listeners
      if (this.eventEmitter) {
        this.eventEmitter.emit('timeupdate', 0);
      }
    }
  }

  fastForward(): void {
    const wasPlaying = this.playbackState === 'playing';
    const duration = this.getDuration();
    if (wasPlaying) {
      this.stop();
      this.play(duration);
    } else {
      this.currentTime = duration;
      if (this.setProgressFn) {
        this.setProgressFn(duration);
      }
      // Emit timeupdate event for external listeners
      if (this.eventEmitter) {
        this.eventEmitter.emit('timeupdate', duration);
      }
    }
  }

  getCurrentTime(): number {
    if (this.playout) {
      return this.playout.getCurrentTime();
    }
    return 0;
  }

  getTracks(): Track[] {
    return this.tracks;
  }

  private createEventEmitter(): any {
    // Return a minimal event emitter for compatibility
    // TODO: Integrate with Zustand store for proper event handling
    const listeners: Map<string, Function[]> = new Map();

    const self = this;

    return {
      on: (event: string, callback: Function) => {
        console.log(`Event listener registered: ${event}`);
        if (!listeners.has(event)) {
          listeners.set(event, []);
        }
        listeners.get(event)!.push(callback);
      },
      emit: (event: string, ...args: any[]) => {
        console.log(`Event emitted: ${event}`, args);

        // Call registered listeners
        if (listeners.has(event)) {
          listeners.get(event)!.forEach(callback => callback(...args));
        }

        // Handle basic events
        switch(event) {
          case 'play':
            self.play();
            break;
          case 'pause':
            self.pause();
            break;
          case 'stop':
            self.stop();
            break;
          case 'rewind':
            self.rewind();
            break;
          case 'fastforward':
            self.fastForward();
            break;
          case 'automaticscroll':
            self.setAutomaticScroll(args[0]);
            break;
          case 'newtrack':
            // Handle adding a new track from a File object
            if (args[0]) {
              self.addTrack(args[0]).catch((error) => {
                console.error('Failed to add new track:', error);
              });
            }
            break;
        }
      },
    };
  }

  getEventEmitter(): any {
    return this.eventEmitter;
  }

  destroy(): void {
    if (this.playout) {
      this.playout.dispose();
    }
    if (this.root) {
      this.root.unmount();
    }
  }
}

// Create the API object
const WaveformPlaylistAPI = {
  init: (config: PlaylistConfig): WaveformPlaylistClass => {
    return new WaveformPlaylistClass(config);
  }
};

// Export for ES modules
export const init = WaveformPlaylistAPI.init;
export type { PlaylistConfig, TrackConfig };

// Default export for UMD
export default WaveformPlaylistAPI;
