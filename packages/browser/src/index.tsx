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
  VolumeSlider,
  VolumeSliderWrapper
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
  options?: {
    controls?: {
      show?: boolean;
      width?: number;
    };
  };
  zoomLevels?: number[];
  state?: string;
  timescale?: boolean;
  isAutomaticScroll?: boolean;
}

interface TrackConfig {
  src: string;
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

  constructor(config: PlaylistConfig) {
    this.container = config.container;
    this.config = config;

    // Clear container
    this.container.innerHTML = '';

    // Create React root
    this.root = createRoot(this.container);

    // Initialize playout
    this.playout = new TonePlayout();
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

  private render(): void {
    if (!this.root) return;

    const theme = {
      ...defaultTheme,
      ...this.config.colors,
    };

    const waveHeight = this.config.waveHeight || 128;
    const samplesPerPixel = this.config.samplesPerPixel || 4096;

    // Check if controls should be shown (support both old and new config formats)
    const showControls = this.config.controls?.show !== false &&
                        this.config.options?.controls?.show !== false;
    const controlsWidth = this.config.controls?.width ||
                         this.config.options?.controls?.width ||
                         150;

    console.log('Config:', this.config);
    console.log('Controls config:', this.config.controls);
    console.log('Show controls:', showControls);

    // Waveform component using Channel from ui-components
    const WaveformDisplay: React.FC<{ trackId: string }> = ({ trackId }) => {
      const peaksData = this.peaksData.get(trackId);
      if (!peaksData || !this.playout) return null;

      const track = this.playout.getTrack(trackId);
      if (!track) return null;

      const buffer = track.buffer;
      const width = peaksData.length;
      const totalHeight = waveHeight * peaksData.data.length;

      return (
        <div style={{ position: 'relative', width: `${width}px`, height: `${totalHeight}px`, background: '#f0f0f0' }}>
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
              progress={0}
            />
          ))}
        </div>
      );
    };

    const TrackControls: React.FC<{ trackId: string; track: Track }> = ({ trackId, track }) => {
      const [muted, setMuted] = React.useState(track.muted);
      const [soloed, setSoloed] = React.useState(track.soloed);
      const [gain, setGain] = React.useState(track.gain);

      return (
        <Controls>
          <Header>{track.name}</Header>
          <ButtonGroup>
            <Button
              onClick={() => {
                const newMuted = !muted;
                setMuted(newMuted);
                this.setTrackMute(trackId, newMuted);
              }}
              style={{
                backgroundColor: muted ? '#ff6b6b' : '#f0f0f0',
                fontWeight: muted ? 'bold' : 'normal',
              }}
            >
              {muted ? 'M' : 'M'}
            </Button>
            <Button
              onClick={() => {
                const newSoloed = !soloed;
                setSoloed(newSoloed);
                this.setTrackSolo(trackId, newSoloed);
              }}
              style={{
                backgroundColor: soloed ? '#51cf66' : '#f0f0f0',
                fontWeight: soloed ? 'bold' : 'normal',
              }}
            >
              {soloed ? 'S' : 'S'}
            </Button>
          </ButtonGroup>
          <VolumeSliderWrapper>
            <VolumeSlider
              min={0}
              max={200}
              value={gain * 100}
              onChange={(e) => {
                const newGain = parseInt(e.currentTarget.value) / 100;
                setGain(newGain);
                this.setTrackGain(trackId, newGain);
              }}
            />
            <div style={{ fontSize: '11px', marginTop: '4px', color: '#666' }}>
              {Math.round(gain * 100)}%
            </div>
          </VolumeSliderWrapper>
        </Controls>
      );
    };

    this.root.render(
      <ThemeProvider theme={theme}>
        <div style={{ fontFamily: 'Arial, sans-serif' }}>
          <div style={{ marginTop: '20px' }}>
            {this.tracks.map((track) => (
              <div
                key={track.id}
                style={{
                  marginBottom: '20px',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'stretch',
                }}
              >
                {showControls && (
                  <div style={{ width: `${controlsWidth}px`, flexShrink: 0 }}>
                    <TrackControls trackId={track.id} track={track} />
                  </div>
                )}
                <div style={{ flex: 1, overflow: 'auto' }}>
                  <WaveformDisplay trackId={track.id} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '20px', color: '#666', fontSize: '12px', textAlign: 'center' }}>
            ✨ Powered by Tone.js 15.1.22 and React 18
          </div>
        </div>
      </ThemeProvider>
    );
  }

  async play(startTime?: number): Promise<void> {
    if (this.playout) {
      // Initialize playout on first play (requires user gesture)
      await this.playout.init();
      this.playout.play(undefined, startTime ?? 0);
    }
  }

  pause(): void {
    if (this.playout) {
      this.playout.pause();
    }
  }

  stop(): void {
    if (this.playout) {
      this.playout.stop();
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

  getCurrentTime(): number {
    if (this.playout) {
      return this.playout.getCurrentTime();
    }
    return 0;
  }

  getTracks(): Track[] {
    return this.tracks;
  }

  getEventEmitter(): any {
    // Return a minimal event emitter for compatibility
    // TODO: Integrate with Zustand store for proper event handling
    return {
      on: (event: string) => {
        console.log(`Event listener registered: ${event}`);
      },
      emit: (event: string, ...args: any[]) => {
        console.log(`Event emitted: ${event}`, args);

        // Handle basic events
        switch(event) {
          case 'play':
            this.play();
            break;
          case 'pause':
            this.pause();
            break;
          case 'stop':
            this.stop();
            break;
        }
      },
    };
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
