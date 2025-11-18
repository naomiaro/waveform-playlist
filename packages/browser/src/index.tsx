import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ThemeProvider } from 'styled-components';
import { TonePlayout } from '@waveform-playlist/playout';
import { LoaderFactory } from '@waveform-playlist/loaders';
import { Track } from '@waveform-playlist/core';
import { getContext } from 'tone';
import { Channel } from '@waveform-playlist/ui-components';
import { generatePeaks } from './peaksUtil';
import type { PeakData } from '@waveform-playlist/webaudio-peaks';

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

    // Don't initialize playout here - it will be initialized on first play()
    // to comply with browser autoplay policies

    // Render the playlist (for now, just a simple div with track info)
    this.render();
  }

  private render(): void {
    if (!this.root) return;

    const theme = {
      ...defaultTheme,
      ...this.config.colors,
    };

    const waveHeight = this.config.waveHeight || 128;
    const samplesPerPixel = this.config.samplesPerPixel || 4096;

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
          {peaksData.data.map((channelData, index) => (
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

    this.root.render(
      <ThemeProvider theme={theme}>
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
          <h3>Waveform Playlist</h3>
          <div style={{ marginTop: '20px' }}>
            {this.tracks.map((track) => (
              <div
                key={track.id}
                style={{
                  marginBottom: '20px',
                }}
              >
                <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
                  {track.name}
                </div>
                <WaveformDisplay trackId={track.id} />
                <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
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
