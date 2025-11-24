import type { Meta, StoryObj } from '@storybook/react';
import React, { useState, useEffect } from 'react';
import {
  loadWaveformData,
  waveformDataToPeaks,
  getWaveformDataMetadata,
} from '@waveform-playlist/browser';
import { SmartChannel } from '../components/SmartChannel';

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
  const [peaks, setPeaks] = useState<Int16Array | null>(null);
  const [metadata, setMetadata] = useState<{
    sampleRate: number;
    channels: number;
    duration: number;
    samplesPerPixel: number;
    length: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        </div>
      )}

      {peaks && metadata && (
        <div
          style={{
            width: '100%',
            height: 128,
            backgroundColor: '#1a1a2e',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <SmartChannel
            index={0}
            data={peaks}
            bits={16}
            length={metadata.length}
            progress={0}
          />
        </div>
      )}
    </div>
  );
};

// Multiple tracks demo
const MultiTrackDemo: React.FC = () => {
  const tracks = [
    { src: '/media/audio/Vocals30.dat', name: 'Vocals' },
    { src: '/media/audio/Guitar30.dat', name: 'Guitar' },
    { src: '/media/audio/BassDrums30.dat', name: 'Bass & Drums' },
    { src: '/media/audio/PianoSynth30.dat', name: 'Piano Synth' },
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
  render: () => <WaveformDataDemo src="/media/vocals.dat" title="Vocals Track" />,
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

export const MetadataOnly: StoryObj = {
  render: () => {
    const [metadata, setMetadata] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      getWaveformDataMetadata('/media/vocals.dat')
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
