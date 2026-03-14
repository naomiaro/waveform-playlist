import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';
import { AudioCredits } from '../../components/AudioCredits';

const LazyPitchShiftingExample = createLazyExample(() =>
  import('../../components/examples/PitchShiftingExample').then((m) => ({
    default: m.PitchShiftingExample,
  }))
);

export default function PitchShiftingExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Pitch Shifting — SoundTouch AudioWorklet with Waveform Playlist"
      description="Pitch-preserving speed control using SoundTouch AudioWorklet with browser MediaElement and WebAudio playback"
    >
      <Head>
        <meta
          property="og:title"
          content="Pitch Shifting — SoundTouch AudioWorklet - Waveform Playlist"
        />
        <meta
          property="og:description"
          content="Pitch-preserving speed control using SoundTouch AudioWorklet with browser MediaElement and WebAudio playback"
        />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Pitch Shifting — SoundTouch AudioWorklet - Waveform Playlist"
        />
        <meta
          name="twitter:description"
          content="Pitch-preserving speed control using SoundTouch AudioWorklet with browser MediaElement and WebAudio playback"
        />
        <meta
          name="keywords"
          content="pitch shift, pitch shifting, soundtouch, audio worklet, playback speed, playback rate, pitch preservation, time stretching, web audio, media element, tempo control, react audio player, waveform playlist, slow down audio, speed up audio"
        />
      </Head>
      <main className="container margin-vert--lg">
        <h1>Pitch Shifting</h1>
        <p style={{ marginBottom: '0.5rem' }}>
          Pitch-preserving speed control powered by{' '}
          <a
            href="https://www.npmjs.com/package/@soundtouchjs/audio-worklet"
            target="_blank"
            rel="noopener noreferrer"
          >
            @soundtouchjs/audio-worklet
          </a>
          . Change playback speed without changing pitch — great for music
          practice, transcription, language learning, and accessibility.
        </p>
        <p
          style={{
            marginBottom: '2rem',
            fontSize: '0.9rem',
            color: 'var(--ifm-font-color-secondary)',
          }}
        >
          The first player uses the browser&apos;s built-in time-stretching.
          The second and third route audio through a SoundTouch AudioWorklet
          for pitch-preserving speed control with additional effect chaining.
        </p>

        <LazyPitchShiftingExample />

        <div style={{ marginTop: '2rem' }}>
          <h2>When to Use Each Approach</h2>
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Browser Speed</th>
                <th>MediaElement + SoundTouch</th>
                <th>WebAudio + SoundTouch</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Audio loading</td>
                <td>Streams (no full download)</td>
                <td>Streams (no full download)</td>
                <td>Full decode into memory</td>
              </tr>
              <tr>
                <td>Pitch preserved</td>
                <td>Yes (browser built-in)</td>
                <td>Yes (SoundTouch algorithm)</td>
                <td>Yes (SoundTouch algorithm)</td>
              </tr>
              <tr>
                <td>Effect chaining</td>
                <td>Not possible</td>
                <td>Via Web Audio graph</td>
                <td>Full Tone.js chain</td>
              </tr>
              <tr>
                <td>Multi-track</td>
                <td>Single track</td>
                <td>Single track</td>
                <td>Full support</td>
              </tr>
              <tr>
                <td>Dependencies</td>
                <td>None</td>
                <td>@soundtouchjs/audio-worklet</td>
                <td>@soundtouchjs/audio-worklet</td>
              </tr>
              <tr>
                <td>Best for</td>
                <td>Simple playback</td>
                <td>Streaming + effects</td>
                <td>DAW-style editing</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p style={{ marginTop: '1.5rem' }}>
          See the{' '}
          <a href="/waveform-playlist/docs/guides/media-element-playout">
            Media Element Playout Guide
          </a>{' '}
          for implementation details and the{' '}
          <a href="/waveform-playlist/examples/effects">Effects Example</a> for
          a full multi-track effects demo.
        </p>

        <AudioCredits track="ubiquitous" />
      </main>
    </Layout>
  );
}
