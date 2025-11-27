import type { Meta, StoryObj } from '@storybook/react';
import React, { useState, useEffect } from 'react';
import {
  loadWaveformData,
  waveformDataToPeaks,
  getWaveformDataMetadata,
} from '@waveform-playlist/browser';
import { Channel } from '../components/Channel';

/**
 * BBC Waveform Data Loading
 *
 * These stories demonstrate loading pre-computed waveform data in BBC's
 * waveform-data.js format (.dat binary or .json files).
 *
 * BBC's audiowaveform tool generates these files from audio, allowing
 * fast waveform rendering without processing audio in the browser.
 *
 * @see https://github.com/bbc/audiowaveform
 * @see https://github.com/bbc/waveform-data.js
 */

// Demo component for loading and displaying BBC peaks
const WaveformDataDemo: React.FC<{ src: string; title: string }> = ({ src, title }) => {
  const [peaks, setPeaks] = useState<Int8Array | Int16Array | null>(null);
  const [bits, setBits] = useState<8 | 16>(8);
  const [metadata, setMetadata] = useState<{
    sampleRate: number;
    channels: number;
    duration: number;
    samplesPerPixel: number;
    length: number;
    bits: 8 | 16;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use actual device pixel ratio for crisp rendering on high-DPI displays
  const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;

  useEffect(() => {
    async function loadPeaks() {
      try {
        setLoading(true);
        setError(null);

        // Load metadata first
        const meta = await getWaveformDataMetadata(src);
        setMetadata(meta);

        // Load the waveform data
        const waveformData = await loadWaveformData(src);
        const peaksData = waveformDataToPeaks(waveformData, 0);
        setPeaks(peaksData.data);
        setBits(peaksData.bits);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load waveform data');
      } finally {
        setLoading(false);
      }
    }

    loadPeaks();
  }, [src]);

  if (loading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        Loading waveform data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '1rem', color: 'red' }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h3 style={{ margin: '0 0 0.5rem 0' }}>{title}</h3>

      {metadata && (
        <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#666' }}>
          <div><strong>Sample Rate:</strong> {metadata.sampleRate} Hz</div>
          <div><strong>Channels:</strong> {metadata.channels}</div>
          <div><strong>Duration:</strong> {metadata.duration.toFixed(2)}s</div>
          <div><strong>Samples/Pixel:</strong> {metadata.samplesPerPixel}</div>
          <div><strong>Peak Length:</strong> {metadata.length} points</div>
          <div><strong>Bit Depth:</strong> {metadata.bits}-bit</div>
        </div>
      )}

      {peaks && metadata && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 128,
            backgroundColor: '#1a1a2e',
            borderRadius: '4px',
            overflowX: 'auto',
            overflowY: 'hidden',
          }}
        >
          <div style={{ width: metadata.length, height: 128, position: 'relative' }}>
            <Channel
              key={src}
              index={0}
              data={peaks}
              bits={bits}
              length={metadata.length}
              waveHeight={128}
              devicePixelRatio={devicePixelRatio}
              waveOutlineColor="#005BBB"
              waveFillColor="#F4D35E"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Multiple tracks demo - Albert Kader "Ubiquitous" minimal techno
const MultiTrackDemo: React.FC = () => {
  const tracks = [
    { src: 'media/audio/AlbertKader_Ubiquitous/01_Kick.dat', name: 'Kick' },
    { src: 'media/audio/AlbertKader_Ubiquitous/08_Bass.dat', name: 'Bass' },
    { src: 'media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.dat', name: 'Synth 1' },
    { src: 'media/audio/AlbertKader_Ubiquitous/11_Synth2.dat', name: 'Synth 2' },
  ];

  return (
    <div>
      <h2 style={{ margin: '0 0 1rem 0' }}>Multi-Track BBC Peaks</h2>
      <p style={{ marginBottom: '1rem', color: '#666' }}>
        Pre-computed peaks from BBC audiowaveform tool at 30 samples/pixel.
      </p>
      {tracks.map((track) => (
        <WaveformDataDemo key={track.src} src={track.src} title={track.name} />
      ))}
    </div>
  );
};

// Bit depth comparison demo - using same 8-bit files (all new tracks are 8-bit)
const BitDepthComparisonDemo: React.FC = () => {
  const tracks = [
    { src: 'media/audio/AlbertKader_Ubiquitous/01_Kick.dat', name: 'Kick (8-bit, mono)' },
    { src: 'media/audio/AlbertKader_Ubiquitous/02_HiHat1.dat', name: 'HiHat (8-bit, mono)' },
    { src: 'media/audio/AlbertKader_Whiptails/03_Kick.dat', name: 'Kick 2 (8-bit, mono)' },
    { src: 'media/audio/AlbertKader_Whiptails/06_HiHat.dat', name: 'HiHat 2 (8-bit, mono)' },
  ];

  return (
    <div>
      <h2 style={{ margin: '0 0 1rem 0' }}>Bit Depth Comparison (Version 1 - Mono)</h2>
      <p style={{ marginBottom: '1rem', color: '#666' }}>
        Compare 8-bit vs 16-bit waveform data. 8-bit files are half the size but have less precision.
      </p>
      {tracks.map((track) => (
        <WaveformDataDemo key={track.src} src={track.src} title={track.name} />
      ))}
    </div>
  );
};

// Stereo demo component - renders both left and right channels
const StereoWaveformDemo: React.FC<{ src: string; title: string }> = ({ src, title }) => {
  const [leftPeaks, setLeftPeaks] = useState<Int8Array | Int16Array | null>(null);
  const [rightPeaks, setRightPeaks] = useState<Int8Array | Int16Array | null>(null);
  const [bits, setBits] = useState<8 | 16>(8);
  const [metadata, setMetadata] = useState<{
    sampleRate: number;
    channels: number;
    duration: number;
    samplesPerPixel: number;
    length: number;
    bits: 8 | 16;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  const channelHeight = 64; // Height per channel

  useEffect(() => {
    async function loadPeaks() {
      try {
        setLoading(true);
        setError(null);

        const meta = await getWaveformDataMetadata(src);
        setMetadata(meta);

        const waveformData = await loadWaveformData(src);

        // Load left channel (index 0)
        const leftData = waveformDataToPeaks(waveformData, 0);
        setLeftPeaks(leftData.data);
        setBits(leftData.bits);

        // Load right channel (index 1) if available
        if (meta.channels > 1) {
          const rightData = waveformDataToPeaks(waveformData, 1);
          setRightPeaks(rightData.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load waveform data');
      } finally {
        setLoading(false);
      }
    }

    loadPeaks();
  }, [src]);

  if (loading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        Loading waveform data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '1rem', color: 'red' }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h3 style={{ margin: '0 0 0.5rem 0' }}>{title}</h3>

      {metadata && (
        <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#666' }}>
          <div><strong>Sample Rate:</strong> {metadata.sampleRate} Hz</div>
          <div><strong>Channels:</strong> {metadata.channels}</div>
          <div><strong>Duration:</strong> {metadata.duration.toFixed(2)}s</div>
          <div><strong>Samples/Pixel:</strong> {metadata.samplesPerPixel}</div>
          <div><strong>Peak Length:</strong> {metadata.length} points</div>
          <div><strong>Bit Depth:</strong> {metadata.bits}-bit</div>
        </div>
      )}

      {leftPeaks && metadata && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: channelHeight * (rightPeaks ? 2 : 1),
            backgroundColor: '#1a1a2e',
            borderRadius: '4px',
            overflowX: 'auto',
            overflowY: 'hidden',
          }}
        >
          <div style={{ width: metadata.length, height: channelHeight * (rightPeaks ? 2 : 1), position: 'relative' }}>
            {/* Left channel */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%' }}>
              <div style={{
                fontSize: '10px',
                color: '#888',
                position: 'absolute',
                top: 2,
                left: 4,
                zIndex: 1
              }}>
                L
              </div>
              <Channel
                key={`${src}-left`}
                index={0}
                data={leftPeaks}
                bits={bits}
                length={metadata.length}
                waveHeight={channelHeight}
                devicePixelRatio={devicePixelRatio}
                waveOutlineColor="#005BBB"
                waveFillColor="#F4D35E"
              />
            </div>

            {/* Right channel */}
            {rightPeaks && (
              <div style={{ position: 'absolute', top: channelHeight, left: 0, width: '100%' }}>
                <div style={{
                  fontSize: '10px',
                  color: '#888',
                  position: 'absolute',
                  top: 2,
                  left: 4,
                  zIndex: 1
                }}>
                  R
                </div>
                <Channel
                  key={`${src}-right`}
                  index={0}
                  data={rightPeaks}
                  bits={bits}
                  length={metadata.length}
                  waveHeight={channelHeight}
                  devicePixelRatio={devicePixelRatio}
                  waveOutlineColor="#BB5500"
                  waveFillColor="#5EF4D3"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Stereo/Version 2 comparison demo - using stereo tracks from Ubiquitous
const StereoComparisonDemo: React.FC = () => {
  const tracks = [
    { src: 'media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.dat', name: 'Synth 1 (stereo)' },
    { src: 'media/audio/AlbertKader_Ubiquitous/11_Synth2.dat', name: 'Synth 2 (stereo)' },
  ];

  return (
    <div>
      <h2 style={{ margin: '0 0 1rem 0' }}>Stereo / Version 2 Files</h2>
      <p style={{ marginBottom: '1rem', color: '#666' }}>
        Version 2 files support multiple channels. These are stereo files generated with --split-channels.
        Left (L) and Right (R) channels are displayed separately.
      </p>
      {tracks.map((track) => (
        <StereoWaveformDemo key={track.src} src={track.src} title={track.name} />
      ))}
    </div>
  );
};

const meta: Meta = {
  title: 'Browser/WaveformData',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
# BBC Waveform Data Loading

Load pre-computed waveform peaks from BBC's audiowaveform tool format.

## Why Use Pre-computed Peaks?

- **Faster loading** - No need to decode audio and compute peaks in browser
- **Server-side generation** - Use BBC's audiowaveform CLI tool
- **Smaller payloads** - Peaks files are much smaller than audio files
- **Consistent results** - Same peaks regardless of browser/platform

## Generating Peaks with audiowaveform

\`\`\`bash
# Install audiowaveform (macOS)
brew install audiowaveform

# Generate binary .dat file
audiowaveform -i audio.mp3 -o peaks.dat -z 256 -b 8

# Generate JSON file
audiowaveform -i audio.mp3 -o peaks.json -z 256 -b 8
\`\`\`

## Usage in Code

\`\`\`tsx
import { loadPeaksFromWaveformData } from '@waveform-playlist/browser';

// Load and convert in one step
const peaks = await loadPeaksFromWaveformData('/path/to/peaks.dat');

// Use with SmartChannel or your waveform component
<SmartChannel
  data={peaks.data}
  bits={peaks.bits}
  length={peaks.length}
/>
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;

export const SingleTrack: StoryObj = {
  render: () => <WaveformDataDemo src="media/audio/AlbertKader_Ubiquitous/08_Bass.dat" title="Bass Track" />,
  parameters: {
    docs: {
      description: {
        story: 'Load a single BBC peaks file and display the waveform with metadata.',
      },
    },
  },
};

export const MultipleFiles: StoryObj = {
  render: () => <MultiTrackDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Load multiple BBC peaks files for a multi-track visualization.',
      },
    },
  },
};

export const BitDepthComparison: StoryObj = {
  render: () => <BitDepthComparisonDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Compare 8-bit and 16-bit waveform data files (Version 1 - mono). 8-bit files are half the size.',
      },
    },
  },
};

export const StereoVersion2: StoryObj = {
  render: () => <StereoComparisonDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Stereo waveform data files using Version 2 format. Generated with --split-channels flag.',
      },
    },
  },
};

export const MetadataOnly: StoryObj = {
  render: () => {
    const [metadata, setMetadata] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      getWaveformDataMetadata('media/audio/AlbertKader_Ubiquitous/08_Bass.dat')
        .then(setMetadata)
        .finally(() => setLoading(false));
    }, []);

    if (loading) return <div>Loading...</div>;

    return (
      <div style={{ padding: '1rem' }}>
        <h3>Waveform Data Metadata</h3>
        <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
          {JSON.stringify(metadata, null, 2)}
        </pre>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Extract metadata from a BBC peaks file without loading the full peaks data.',
      },
    },
  },
};
