import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ThemeProvider } from 'styled-components';
import { TonePlayout, type EffectsFunction } from '@waveform-playlist/playout';
import { LoaderFactory } from '@waveform-playlist/loaders';
import { Track } from '@waveform-playlist/core';
import * as Tone from 'tone';
import type { ToneAudioNode } from 'tone';
import {
  SmartChannel,
  Button,
  Controls,
  VolumeDownIcon,
  VolumeUpIcon,
  Slider,
  StyledTimeScale,
  Playlist,
  Playhead,
  Selection,
  Track as TrackComponent,
  PlaylistInfoContext,
  DevicePixelRatioProvider,
  TrackControlsContext,
  PlayoutProvider,
  usePlayoutStatus,
  usePlayoutStatusUpdate,
  secondsToPixels,
  defaultTheme,
  waveformColorToCss,
} from '@waveform-playlist/ui-components';
import {
  AnnotationBox,
  AnnotationBoxesWrapper,
  AnnotationText,
} from '@waveform-playlist/annotations';
import { generatePeaks } from './peaksUtil';
import type { PeakData, Peaks } from '@waveform-playlist/webaudio-peaks';

interface PlaylistConfig {
  container: HTMLElement;
  samplesPerPixel?: number;
  waveHeight?: number;
  mono?: boolean; // Whether to merge channels to mono (default: true)
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
  effects?: EffectsFunction;
  annotationList?: AnnotationListConfig;
  /** Width in pixels of waveform bars. Default: 1 */
  barWidth?: number;
  /** Spacing in pixels between waveform bars. Default: 0 */
  barGap?: number;
}

export type TrackEffectsFunction = (graphEnd: ToneAudioNode, masterGainNode: ToneAudioNode, isOffline: boolean) => void | (() => void);

export interface Annotation {
  id: string;
  start: number;
  end: number;
  lines: string[];
  language?: string;
  // Support for Aeneas JSON format
  begin?: string | number;
  children?: any[];
}

export interface AnnotationAction {
  class: string;
  title: string;
  action: (annotation: Annotation, index: number, annotations: Annotation[], opts: AnnotationListConfig) => void;
}

export interface AnnotationListConfig {
  annotations: Annotation[];
  controls?: AnnotationAction[];
  editable?: boolean;
  isContinuousPlay?: boolean;
  linkEndpoints?: boolean;
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
  selected?: {
    start: number;
    end: number;
  };
  effects?: TrackEffectsFunction;
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
  private hasSeeked: boolean = false; // Track if user has manually seeked (clicked timeline)
  private animationFrameId: number | null = null;
  private setProgressFn: ((progress: number) => void) | null = null;
  private setSelectionFn: ((start: number, end: number) => void) | null = null;
  private setIsPlayingFn: ((isPlaying: boolean) => void) | null = null;
  private isAutomaticScroll: boolean = false;
  private scrollContainer: HTMLElement | null = null;
  private selectionStart: number = 0;
  private selectionEnd: number = 0;
  private timeFormat: string = 'hh:mm:ss.uuu';
  private isDragging: boolean = false;
  private dragStartTime: number = 0;
  private annotations: Annotation[] = [];
  private activeAnnotationId: string | null = null;
  private lastScrolledAnnotationId: string | null = null;
  private isPlayingTimedSegment: boolean = false;

  constructor(config: PlaylistConfig) {
    this.container = config.container;
    this.config = config;
    this.isAutomaticScroll = config.isAutomaticScroll ?? false;

    // Initialize annotations from config
    if (config.annotationList?.annotations) {
      this.annotations = config.annotationList.annotations.map(note => {
        // Handle both Aeneas format (begin/end as strings) and standard format (start/end as numbers)
        const start = note.begin !== undefined ? parseFloat(note.begin as any) : note.start;
        const end = note.end !== undefined ? (typeof note.end === 'string' ? parseFloat(note.end) : note.end) : note.end;

        return {
          id: note.id,
          start: start,
          end: end,
          lines: note.lines,
          language: note.language,
        };
      });
    }

    // Clear container
    this.container.innerHTML = '';

    // Create React root
    this.root = createRoot(this.container);

    // Initialize playout with optional effects
    this.playout = new TonePlayout({
      effects: this.config.effects,
    });

    // Initialize event emitter
    this.eventEmitter = this.createEventEmitter();
  }

  async load(trackConfigs: TrackConfig[]): Promise<void> {
    // Use Tone's context (it will be in suspended state until user gesture)
    const audioContext = Tone.getContext().rawContext as AudioContext;
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
          src: typeof config.src === 'string' ? config.src : undefined,
          gain: config.gain ?? 1,
          muted: config.muted ?? false,
          soloed: config.soloed ?? false,
          stereoPan: config.stereoPan ?? 0,
          startTime: config.start ?? 0,
          fadeIn: config.fadeIn ? {
            duration: config.fadeIn.duration,
            type: config.fadeIn.shape ?? 'logarithmic',
          } : undefined,
          fadeOut: config.fadeOut ? {
            duration: config.fadeOut.duration,
            type: config.fadeOut.shape ?? 'logarithmic',
          } : undefined,
        };

        loadedTracks.push(track);

        // Generate peaks for waveform visualization
        const samplesPerPixel = this.config.samplesPerPixel || 4096;
        const isMono = this.config.mono ?? true; // Default to mono
        const peaks = generatePeaks(audioBuffer, samplesPerPixel, isMono);
        this.peaksData.set(track.id, peaks);

        // Add to playout engine
        if (this.playout) {
          this.playout.addTrack({
            buffer: audioBuffer,
            track,
            effects: config.effects,
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

    // Setup input listeners after DOM is ready
    setTimeout(() => {
      this.setupSelectionInputListeners();
    }, 0);

    // Handle pre-selection if any track has a selected region
    // Use setTimeout to ensure React component has mounted and setSelectionFn is available
    setTimeout(() => {
      for (let i = 0; i < trackConfigs.length; i++) {
        const config = trackConfigs[i];
        if (config.selected) {
          this.setSelection(config.selected.start, config.selected.end);
          break; // Only use the first track's selection
        }
      }
    }, 100);
  }

  async addTrack(src: string | File, config?: Partial<TrackConfig>): Promise<void> {
    // Use Tone's context
    const audioContext = Tone.getContext().rawContext as AudioContext;

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
        src: typeof trackConfig.src === 'string' ? trackConfig.src : undefined,
        gain: trackConfig.gain ?? 1,
        muted: trackConfig.muted ?? false,
        soloed: trackConfig.soloed ?? false,
        stereoPan: trackConfig.stereoPan ?? 0,
        startTime: trackConfig.start ?? 0,
        fadeIn: trackConfig.fadeIn ? {
          duration: trackConfig.fadeIn.duration,
          type: trackConfig.fadeIn.shape ?? 'logarithmic',
        } : undefined,
        fadeOut: trackConfig.fadeOut ? {
          duration: trackConfig.fadeOut.duration,
          type: trackConfig.fadeOut.shape ?? 'logarithmic',
        } : undefined,
      };

      // Generate peaks for waveform visualization
      const samplesPerPixel = this.config.samplesPerPixel || 4096;
      const isMono = this.config.mono ?? true; // Default to mono
      const peaks = generatePeaks(audioBuffer, samplesPerPixel, isMono);
      this.peaksData.set(track.id, peaks);

      // Add to playout engine
      if (this.playout) {
        this.playout.addTrack({
          buffer: audioBuffer,
          track,
          effects: trackConfig.effects,
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
      const { progress: currentTime, selectionStart, selectionEnd, isPlaying } = usePlayoutStatus();
      const { setProgress, setSelection, setIsPlaying } = usePlayoutStatusUpdate();

      // Store setProgress, setSelection, and setIsPlaying references
      React.useEffect(() => {
        this.setProgressFn = setProgress;
        this.setSelectionFn = setSelection;
        this.setIsPlayingFn = setIsPlaying;
        return () => {
          this.setProgressFn = null;
          this.setSelectionFn = null;
          this.setIsPlayingFn = null;
        };
      }, [setProgress, setSelection, setIsPlaying]);

    // Check if controls should be shown (default: true)
    const showControls = this.config.controls?.show !== false;
    const controlsWidth = this.config.controls?.width || 200;

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
      barWidth: this.config.barWidth ?? 1,
      barGap: this.config.barGap ?? 0,
    };

    // Waveform component using Channel from ui-components - memoize to prevent recreation
    const WaveformDisplay = React.useMemo(() => {
      return React.memo<{ trackId: string; currentTime: number; selectionStart: number; selectionEnd: number; isPlaying: boolean }>(
        ({ trackId, currentTime, selectionStart, selectionEnd, isPlaying }) => {
      const peaksData = this.peaksData.get(trackId);
      if (!peaksData || !this.playout) return null;

      const track = this.playout.getTrack(trackId);
      if (!track) return null;

      const width = peaksData.length;

      // Calculate progress in pixels for this track
      const trackData = this.tracks.find(t => t.id === trackId);
      const trackStartTime = trackData?.startTime || 0;
      const trackDuration = track.buffer.duration;

      // Don't show progress if there's an active selection AND not playing
      const hasSelection = selectionStart !== selectionEnd;
      const shouldShowProgress = isPlaying || !hasSelection;

      // Calculate progress based on how long this track has been playing
      let progressPx = 0;
      if (shouldShowProgress && currentTime >= trackStartTime) {
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
            <SmartChannel
              key={index}
              index={index}
              data={channelData}
              bits={peaksData.bits}
              length={width}
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
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', boxSizing: 'border-box' }}>
            <VolumeDownIcon style={{ fontSize: '10px', width: '12px', flexShrink: 0, textAlign: 'center' }} />
            <Slider
              min={0}
              max={200}
              value={gain * 100}
              onChange={(e) => {
                const newGain = parseInt(e.currentTarget.value) / 100;
                setGain(newGain);
                this.setTrackGain(trackId, newGain);
              }}
              style={{ flex: 1, minWidth: 0 }}
            />
            <VolumeUpIcon style={{ fontSize: '10px', width: '12px', flexShrink: 0, textAlign: 'center' }} />
          </div>
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', boxSizing: 'border-box' }}>
            <span style={{ fontSize: '8px', color: '#666', fontWeight: 'bold', width: '12px', flexShrink: 0, textAlign: 'center' }}>L</span>
            <Slider
              min={-100}
              max={100}
              value={stereoPan * 100}
              onChange={(e) => {
                const newPan = parseInt(e.currentTarget.value) / 100;
                setStereoPan(newPan);
                this.setTrackPan(trackId, newPan);
              }}
              style={{ flex: 1, minWidth: 0 }}
            />
            <span style={{ fontSize: '8px', color: '#666', fontWeight: 'bold', width: '12px', flexShrink: 0, textAlign: 'center' }}>R</span>
          </div>
        </Controls>
      );
      };
    }, []);

    // Calculate timeline width for the timescale
    const playlistDuration = this.playout
      ? secondsToPixels(maxDuration, samplesPerPixel, this.playout.sampleRate)
      : 0;
    // Don't add controlsWidth - controls are sticky on the left and don't add to scrollable width
    const timelineWidth = playlistDuration;
    // Tracks need to include controls width since they take up space in flex layout
    const tracksFullWidth = timelineWidth + (showControls ? controlsWidth : 0);

    return (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={playlistInfo}>
          <ThemeProvider theme={theme}>
            <div style={{ fontFamily: 'Arial, sans-serif' }}>
              <Playlist
                theme={theme}
                backgroundColor={waveformColorToCss(theme.waveOutlineColor || '#00f')}
                scrollContainerWidth={tracksFullWidth}
                timescaleWidth={tracksFullWidth}
                tracksWidth={tracksFullWidth}
                controlsWidth={showControls ? controlsWidth : 0}
                onTracksMouseDown={this.handleMouseDown}
                onTracksMouseMove={this.handleMouseMove}
                onTracksMouseUp={this.handleMouseUp}
                scrollContainerRef={(el) => { this.scrollContainer = el; }}
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

                    // Calculate track offset in pixels based on startTime
                    const trackOffsetPx = this.playout
                      ? secondsToPixels(track.startTime, samplesPerPixel, this.playout.sampleRate)
                      : 0;

                    return (
                      <TrackControlsContext.Provider key={track.id} value={trackControls}>
                        <TrackComponent
                          numChannels={peaksData.data.length}
                          backgroundColor={waveformColorToCss(theme.waveOutlineColor || '#00f')}
                          offset={trackOffsetPx}
                          width={tracksFullWidth}
                        >
                          <WaveformDisplay
                            trackId={track.id}
                            currentTime={currentTime}
                            selectionStart={selectionStart}
                            selectionEnd={selectionEnd}
                            isPlaying={isPlaying}
                          />
                        </TrackComponent>
                      </TrackControlsContext.Provider>
                    );
                  })}
                  {/* Render annotation boxes if annotations are configured */}
                  {this.annotations.length > 0 && this.playout && (
                    <AnnotationBoxesWrapper
                      height={30}
                      width={tracksFullWidth}
                    >
                      {this.annotations.map((annotation, index) => {
                        const startPx = secondsToPixels(annotation.start, samplesPerPixel, this.playout!.sampleRate);
                        const endPx = secondsToPixels(annotation.end, samplesPerPixel, this.playout!.sampleRate);

                        return (
                          <AnnotationBox
                            key={annotation.id}
                            annotationId={annotation.id}
                            annotationIndex={index}
                            startPosition={startPx}
                            endPosition={endPx}
                            label={annotation.id}
                            color="#ff9800"
                            isActive={annotation.id === this.activeAnnotationId}
                            editable={false} // Class-based API doesn't support DndContext
                            onClick={async () => {
                              this.activeAnnotationId = annotation.id;
                              this.lastScrolledAnnotationId = annotation.id; // Mark that we're scrolling to this annotation
                              // Calculate duration if continuous play is disabled
                              const duration = this.config.annotationList?.isContinuousPlay === false
                                ? annotation.end - annotation.start
                                : undefined;
                              await this.play(annotation.start, duration);
                              this.render();
                            }}
                          />
                        );
                      })}
                    </AnnotationBoxesWrapper>
                  )}
                  {this.tracks.length > 0 && this.playout && (
                    <>
                      {selectionStart !== selectionEnd && (
                        <Selection
                          startPosition={secondsToPixels(selectionStart, samplesPerPixel, this.playout.sampleRate) + (showControls ? controlsWidth : 0)}
                          endPosition={secondsToPixels(selectionEnd, samplesPerPixel, this.playout.sampleRate) + (showControls ? controlsWidth : 0)}
                          color="#00ff00"
                        />
                      )}
                      {isPlaying && (
                        <Playhead
                          position={secondsToPixels(currentTime, samplesPerPixel, this.playout.sampleRate) + (showControls ? controlsWidth : 0)}
                          color={theme.waveProgressColor || '#f00'}
                        />
                      )}
                    </>
                  )}
                </>
              </Playlist>
              {/* Render annotation text panel if annotations are configured */}
              {this.annotations.length > 0 && (
                <AnnotationText
                  key="annotation-text-panel"
                  annotations={this.annotations}
                  activeAnnotationId={this.activeAnnotationId || undefined}
                  shouldScrollToActive={this.activeAnnotationId === this.lastScrolledAnnotationId}
                  editable={this.config.annotationList?.editable}
                  // Legacy API uses different types - cast for compatibility
                  controls={this.config.annotationList?.controls as any}
                  annotationListConfig={this.config.annotationList as any}
                  onAnnotationClick={(annotation) => {
                    // Just select and seek, don't auto-play
                    this.activeAnnotationId = annotation.id;
                    this.seek(annotation.start);
                    this.render();
                  }}
                  onAnnotationUpdate={(updatedAnnotations) => {
                    this.annotations = updatedAnnotations;
                    this.render();
                  }}
                />
              )}
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

  async play(startTime?: number, duration?: number): Promise<void> {
    if (this.playout) {
      // Initialize playout on first play (requires user gesture)
      await this.playout.init();

      console.log('Playing from:', { startTime, duration, playbackState: this.playbackState, currentTime: this.currentTime, hasSeeked: this.hasSeeked });

      // Determine where to start playing
      let playFrom: number;
      if (startTime !== undefined) {
        playFrom = startTime;
      } else if (this.selectionStart !== this.selectionEnd && this.currentTime < this.selectionStart) {
        // If there's a selection and we're before it, start from selection start
        playFrom = this.selectionStart;
      } else {
        playFrom = this.currentTime;
      }
      console.log('Playing from position:', playFrom, 'for duration:', duration);

      this.playout.stop();
      this.currentTime = playFrom;
      this.hasSeeked = false;

      // Set up callback for when playback completes (if playing with duration)
      if (duration !== undefined) {
        this.isPlayingTimedSegment = true;
        this.playout.setOnPlaybackComplete(() => {
          // Only pause if still playing, but keep the active annotation highlighted
          if (this.playbackState === 'playing') {
            this.isPlayingTimedSegment = false;
            this.pause(false);
          }
        });
      } else {
        this.isPlayingTimedSegment = false;
      }

      // Play with duration if specified
      this.playout.play(Tone.now(), playFrom, duration);

      this.playbackState = 'playing';
      if (this.setIsPlayingFn) {
        this.setIsPlayingFn(true);
      }
      this.startAnimation();
    }
  }

  pause(clearActiveAnnotation: boolean = true): void {
    console.log('[Playlist] pause called - clearActiveAnnotation:', clearActiveAnnotation, 'activeAnnotationId:', this.activeAnnotationId);
    if (this.playout) {
      this.playout.pause();
      this.playbackState = 'paused';
      this.isPlayingTimedSegment = false;
      if (clearActiveAnnotation) {
        this.activeAnnotationId = null;
        this.lastScrolledAnnotationId = null;
      } else {
        // Reset scroll tracking so we don't scroll on remount
        this.lastScrolledAnnotationId = null;
      }
      console.log('[Playlist] after pause - activeAnnotationId:', this.activeAnnotationId);
      this.currentTime = 0;
      if (this.setIsPlayingFn) {
        this.setIsPlayingFn(false);
      }
      if (this.setProgressFn) {
        this.setProgressFn(0);
      }
      this.stopAnimation();
      this.render();
    }
  }

  stop(): void {
    if (this.playout) {
      this.playout.stop();
      this.playbackState = 'stopped';
      this.isPlayingTimedSegment = false;
      this.activeAnnotationId = null;
      if (this.setIsPlayingFn) {
        this.setIsPlayingFn(false);
      }
      this.stopAnimation();
      this.currentTime = 0;
      if (this.setProgressFn) {
        this.setProgressFn(0);
      }
      // Emit timeupdate event for external listeners
      if (this.eventEmitter) {
        this.eventEmitter.emit('timeupdate', 0);
      }
      this.render();
      // Scroll back to the beginning
      if (this.scrollContainer) {
        this.scrollContainer.scrollLeft = 0;
      }
    }
  }

  seek(time: number): void {
    // Seek to a specific time without starting playback
    this.currentTime = Math.max(0, time);
    this.hasSeeked = true;

    if (this.setProgressFn) {
      this.setProgressFn(this.currentTime);
    }

    // Emit timeupdate event for external listeners
    if (this.eventEmitter) {
      this.eventEmitter.emit('timeupdate', this.currentTime);
    }

    this.render();
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

      // Update active annotation based on current playback time (only while playing)
      // Skip this when playing a timed segment to avoid brief highlighting of next annotation
      if (this.annotations.length > 0 && this.playbackState === 'playing' && !this.isPlayingTimedSegment) {
        const currentAnnotation = this.annotations.find(
          ann => this.currentTime >= ann.start && this.currentTime < ann.end
        );
        const newActiveId = currentAnnotation ? currentAnnotation.id : null;
        if (newActiveId !== this.activeAnnotationId) {
          this.activeAnnotationId = newActiveId;
          // Re-render to update highlighted annotation
          this.render();
        }
      }

      // Check if playback has reached the selection end
      if (this.selectionStart !== this.selectionEnd && this.currentTime >= this.selectionEnd) {
        this.stop();
        return;
      }

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

  private getTimeFromMouseEvent = (e: React.MouseEvent<HTMLDivElement>): number | null => {
    if (!this.playout || !this.scrollContainer) {
      return null;
    }

    const rect = e.currentTarget.getBoundingClientRect();

    // Calculate position relative to timeline start
    // rect.left already accounts for the ClickOverlay's left offset (which includes controlsWidth)
    const clickX = e.clientX - rect.left;

    // Convert pixels to seconds
    const samplesPerPixel = this.config.samplesPerPixel || 4096;
    const pixelsPerSecond = this.playout.sampleRate / samplesPerPixel;
    const clickTime = clickX / pixelsPerSecond;

    const duration = this.getDuration();
    return Math.max(0, Math.min(clickTime, duration));
  };

  private handleMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    const clickTime = this.getTimeFromMouseEvent(e);
    if (clickTime === null) return;

    this.isDragging = true;
    this.dragStartTime = clickTime;

    // Start selection at click position
    this.setSelection(clickTime, clickTime);
  };

  private handleMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!this.isDragging) return;

    const currentTime = this.getTimeFromMouseEvent(e);
    if (currentTime === null) return;

    // Update selection end to current mouse position
    const start = Math.min(this.dragStartTime, currentTime);
    const end = Math.max(this.dragStartTime, currentTime);
    this.setSelection(start, end);

    // Force re-render to show updated selection
    if (this.setProgressFn) {
      this.setProgressFn(this.currentTime);
    }
  };

  private handleMouseUp = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!this.isDragging) return;

    const endTime = this.getTimeFromMouseEvent(e);
    if (endTime === null) return;

    this.isDragging = false;

    // Finalize selection
    const start = Math.min(this.dragStartTime, endTime);
    const end = Math.max(this.dragStartTime, endTime);

    // If it was just a click (no drag), seek to that position
    if (Math.abs(end - start) < 0.1) {
      this.currentTime = start;
      if (this.setProgressFn) {
        this.setProgressFn(start);
      }

      // Emit timeupdate event
      if (this.eventEmitter) {
        this.eventEmitter.emit('timeupdate', start);
      }

      // Seek to the new position
      if (this.playbackState === 'playing') {
        this.play(start);
      } else {
        if (this.playout) {
          this.playout.stop();
        }
        this.hasSeeked = true;
      }
    } else {
      // It was a drag - update the selection and reset currentTime to selection start
      this.setSelection(start, end);
      this.currentTime = start;
      if (this.setProgressFn) {
        this.setProgressFn(start);
      }
    }
  };

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

  private parseTime(timeString: string): number {
    // Try to parse as clock format (hh:mm:ss.uuu)
    const clockMatch = timeString.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
    if (clockMatch) {
      const hours = parseInt(clockMatch[1], 10);
      const minutes = parseInt(clockMatch[2], 10);
      const seconds = parseFloat(clockMatch[3]);
      return hours * 3600 + minutes * 60 + seconds;
    }

    // Try to parse as plain seconds
    const seconds = parseFloat(timeString);
    if (!isNaN(seconds)) {
      return seconds;
    }

    return 0;
  }

  private formatTime(seconds: number): string {
    const clockFormat = (secs: number, decimals: number): string => {
      const hours = Math.floor(secs / 3600) % 24;
      const minutes = Math.floor(secs / 60) % 60;
      const s = (secs % 60).toFixed(decimals);

      return String(hours).padStart(2, '0') + ':' +
             String(minutes).padStart(2, '0') + ':' +
             s.padStart(decimals + 3, '0');
    };

    const formats: Record<string, (s: number) => string> = {
      'seconds': (s) => s.toFixed(0),
      'thousandths': (s) => s.toFixed(3),
      'hh:mm:ss': (s) => clockFormat(s, 0),
      'hh:mm:ss.u': (s) => clockFormat(s, 1),
      'hh:mm:ss.uu': (s) => clockFormat(s, 2),
      'hh:mm:ss.uuu': (s) => clockFormat(s, 3),
    };

    const formatter = formats[this.timeFormat] || formats['hh:mm:ss.uuu'];
    return formatter(seconds);
  }

  private updateSelectionInputs(): void {
    const audioStart = document.getElementById('audio_start') as HTMLInputElement;
    const audioEnd = document.getElementById('audio_end') as HTMLInputElement;

    if (audioStart) {
      audioStart.value = this.formatTime(this.selectionStart);
    }
    if (audioEnd) {
      audioEnd.value = this.formatTime(this.selectionEnd);
    }
  }

  private setupSelectionInputListeners(): void {
    const audioStart = document.getElementById('audio_start') as HTMLInputElement;
    const audioEnd = document.getElementById('audio_end') as HTMLInputElement;

    if (audioStart) {
      audioStart.addEventListener('change', () => {
        const newStart = this.parseTime(audioStart.value);
        this.setSelection(newStart, this.selectionEnd);
      });
    }

    if (audioEnd) {
      audioEnd.addEventListener('change', () => {
        const newEnd = this.parseTime(audioEnd.value);
        this.setSelection(this.selectionStart, newEnd);
      });
    }
  }

  setSelection(start: number, end: number): void {
    this.selectionStart = start;
    this.selectionEnd = end;
    this.updateSelectionInputs();

    // Update React state for immediate UI feedback
    if (this.setSelectionFn) {
      this.setSelectionFn(start, end);
    }

    if (this.eventEmitter) {
      this.eventEmitter.emit('select', start, end);
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
          case 'durationformat':
            // Update time format and refresh selection inputs
            if (args[0]) {
              self.timeFormat = args[0];
              self.updateSelectionInputs();
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
  },
  Tone: Tone,
};

// Export for ES modules
export const init = WaveformPlaylistAPI.init;
export type { PlaylistConfig, TrackConfig };
export { Tone };
export type { EffectsFunction };

// Export new flexible/headless API
export {
  WaveformPlaylistProvider,
  useWaveformPlaylist,
  usePlaybackAnimation,
  usePlaylistState,
  usePlaylistControls,
  usePlaylistData,
} from './WaveformPlaylistContext';
export type { WaveformPlaylistContextValue, WaveformTrack, TrackState } from './WaveformPlaylistContext';
export {
  useClipDragHandlers,
  useAnnotationDragHandlers,
  useAnnotationKeyboardControls,
  useDragSensors,
  useClipSplitting,
  useKeyboardShortcuts,
  getShortcutLabel,
  useAudioTracks,
  useIntegratedRecording,
  useZoomControls,
  useTimeFormat,
  useMasterVolume,
  useMasterAnalyser,
  useDynamicEffects,
  useTrackDynamicEffects,
  useExportWav,
} from './hooks';
export type {
  AudioTrackConfig,
  UseIntegratedRecordingReturn,
  IntegratedRecordingOptions,
  ZoomControls,
  TimeFormatControls,
  MasterVolumeControls,
  UseDynamicEffectsReturn,
  ActiveEffect,
  UseTrackDynamicEffectsReturn,
  TrackActiveEffect,
  TrackEffectsState,
  ExportOptions,
  ExportResult,
  UseExportWavReturn,
} from './hooks';

// Export effect definitions and factory
export {
  effectDefinitions,
  effectCategories,
  getEffectDefinition,
  getEffectsByCategory,
} from './effects';
export type {
  EffectDefinition,
  EffectParameter,
  ParameterType,
} from './effects';
export {
  createEffectInstance,
  createEffectChain,
} from './effects';
export type { EffectInstance } from './effects';
export {
  PlayButton,
  PauseButton,
  StopButton,
  RewindButton,
  FastForwardButton,
  SkipBackwardButton,
  SkipForwardButton,
  ZoomInButton,
  ZoomOutButton,
  MasterVolumeControl,
  TimeFormatSelect,
  AudioPosition,
  SelectionTimeInputs,
  AutomaticScrollCheckbox,
  ContinuousPlayCheckbox,
  LinkEndpointsCheckbox,
  EditableCheckbox,
  DownloadAnnotationsButton,
  ExportWavButton,
  Waveform,
} from './components';
export type { ExportWavButtonProps } from './components/ExportControls';
export type { WaveformProps } from './components/Waveform';

// Re-export TimeFormat type from ui-components for convenience
export type { TimeFormat } from '@waveform-playlist/ui-components';

// Export waveform-data.js utilities
export {
  loadWaveformData,
  waveformDataToPeaks,
  loadPeaksFromWaveformData,
  getWaveformDataMetadata,
} from './waveformDataLoader';

// Default export for UMD
export default WaveformPlaylistAPI;
