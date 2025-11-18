import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ThemeProvider } from 'styled-components';
import { TonePlayout } from '@waveform-playlist/playout';
import { LoaderFactory } from '@waveform-playlist/loaders';
import { Track } from '@waveform-playlist/core';

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
    const audioContext = new AudioContext();
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

    // Initialize playout
    if (this.playout) {
      await this.playout.init();
    }

    // Render the playlist (for now, just a simple div with track info)
    this.render();
  }

  private render(): void {
    if (!this.root) return;

    const theme = {
      ...defaultTheme,
      ...this.config.colors,
    };

    // For now, render a simple track list
    // TODO: Integrate actual UI components from @waveform-playlist/ui-components
    this.root.render(
      <ThemeProvider theme={theme}>
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
          <h3>Waveform Playlist (React)</h3>
          <div style={{ marginTop: '20px' }}>
            {this.tracks.map((track) => (
              <div
                key={track.id}
                style={{
                  padding: '10px',
                  marginBottom: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              >
                <strong>{track.name}</strong>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  Start: {track.startTime.toFixed(2)}s |
                  Gain: {(track.gain * 100).toFixed(0)}% |
                  Pan: {track.stereoPan.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '20px', color: '#666', fontSize: '12px' }}>
            ✨ Powered by Tone.js 15.1.22 and React 18
          </div>
        </div>
      </ThemeProvider>
    );
  }

  async play(startTime?: number): Promise<void> {
    if (this.playout) {
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

// Export the main API
export function init(config: PlaylistConfig): WaveformPlaylistClass {
  return new WaveformPlaylistClass(config);
}

// Export for UMD bundle
export default {
  init,
};
