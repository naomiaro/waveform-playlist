import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';

const LazyMidiExample = createLazyExample(() =>
  import('../../components/examples/MidiExample').then((m) => ({ default: m.MidiExample }))
);

export default function MidiExamplePage(): React.ReactElement {
  return (
    <Layout
      title="MIDI Playback"
      description="Load and play MIDI files with browser-synthesized instruments using Waveform Playlist"
    >
      <Head>
        <meta property="og:title" content="MIDI Playback - Waveform Playlist" />
        <meta
          property="og:description"
          content="Load and play MIDI files with browser-synthesized instruments using Waveform Playlist"
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-midi.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MIDI Playback - Waveform Playlist" />
        <meta
          name="twitter:description"
          content="Load and play MIDI files with browser-synthesized instruments using Waveform Playlist"
        />
        <meta name="twitter:image" content="https://naomiaro.github.io/waveform-playlist/img/social/example-midi.png" />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Waveform Playlist MIDI Playback',
            description: 'Load and play MIDI files with browser-synthesized instruments. Multi-track piano roll visualization with SoundFont sample playback.',
            applicationCategory: 'MultimediaApplication',
            operatingSystem: 'Any',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
            featureList: [
              'Standard MIDI file loading and parsing',
              'Multi-track piano roll visualization',
              'SoundFont sample playback (SF2)',
              'Tone.js PolySynth fallback synthesis',
              'Drag-and-drop MIDI file import',
              'Per-track mute, solo, volume, and pan controls',
              'Auto-scroll during playback',
            ],
          })}
        </script>
      </Head>
      <main className="container margin-vert--lg">
        <h1>MIDI Playback</h1>
        <p>
          Load a standard MIDI file and play it back using browser-synthesized instruments. Each MIDI
          track becomes a separate timeline track. Drop your own <code>.mid</code> files to add more
          tracks.
        </p>

        <div
          style={{
            marginTop: '2rem',
            padding: '2rem',
            background: 'var(--ifm-background-surface-color)',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--ifm-color-emphasis-300)',
          }}
        >
          <LazyMidiExample />
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h2>About This Example</h2>
          <p>This example demonstrates:</p>
          <ul>
            <li>
              Loading <code>.mid</code> files with <code>loadMidiTracks()</code> from{' '}
              <code>@dawcore/midi</code>
            </li>
            <li>
              Multi-track expansion — one MIDI file produces multiple timeline tracks (one per MIDI
              channel)
            </li>
            <li>SoundFont sample playback for realistic instrument sounds</li>
            <li>Drag-and-drop to add your own MIDI files</li>
            <li>Per-track close buttons and Clear All</li>
          </ul>
          <p>
            The <code>@dawcore/midi</code> package parses the file and builds the tracks; it plays nothing. It outputs{' '}
            <code>ClipTrack[]</code> with <code>midiNotes</code> on each clip. The playout layer
            automatically routes these to <code>SoundFontToneTrack</code> (realistic instrument
            samples) or <code>MidiToneTrack</code> (Tone.js PolySynth fallback) for synthesis.
          </p>
        </div>
      </main>
    </Layout>
  );
}
