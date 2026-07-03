import React from 'react';
import Layout from '@theme/Layout';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';

const LazyWcPlayer = createLazyExample(() =>
  import('../../components/examples/WcPlayerExample').then((m) => ({ default: m.default }))
);

export default function WcPlayerPage(): React.ReactElement {
  return (
    <Layout
      title="Web Components — Player"
      description="Lightweight <daw-player> single-track player. HTMLMediaElement streaming, pre-computed peaks, no Tone.js."
    >
      <main className="container margin-vert--lg">
        <h1>Web Components — Player</h1>
        <p>
          <code>&lt;daw-player&gt;</code> is a lightweight single-track player from{' '}
          <code>@dawcore/components</code>: it wraps an <code>HTMLMediaElement</code>, so audio
          streams instead of decoding into memory — no Tone.js, no engine, no AudioContext to
          manage. Click the waveform to seek.
        </p>
        <LazyWcPlayer />
        <div style={{ marginTop: '2rem' }}>
          <h2>What's in it</h2>
          <ul>
            <li>
              <code>src</code> streams through an <code>HTMLMediaElement</code> — instant start, no
              full decode
            </li>
            <li>
              <code>peaks-src</code> renders a waveform from pre-computed BBC{' '}
              <code>audiowaveform</code> peaks (<code>.dat</code>/<code>.json</code>); without it
              the player falls back to a scrubber bar
            </li>
            <li>
              <code>timescale</code> adds the time ruler; <code>wave-height</code>,{' '}
              <code>bar-width</code>/<code>bar-gap</code>, <code>mono</code> and the{' '}
              <code>--daw-*</code> CSS custom properties handle presentation
            </li>
            <li>
              Methods: <code>play()</code>, <code>pause()</code>, <code>stop()</code>,{' '}
              <code>seekTo(s)</code>, <code>setPlaybackRate(r)</code>, <code>setVolume(v)</code>
            </li>
            <li>
              Events: <code>daw-ready</code>, <code>daw-play</code>, <code>daw-pause</code>,{' '}
              <code>daw-stop</code>, <code>daw-timeupdate</code> (<code>{'{ time }'}</code>),{' '}
              <code>daw-ended</code>, <code>daw-error</code> — the readout above is driven by them
            </li>
          </ul>
          <h2>Run it locally</h2>
          <p>
            The same example as a standalone Vite app: <code>pnpm example:dawcore-native</code> →
            opens <code>examples/dawcore-native/player.html</code>.
          </p>
        </div>
      </main>
    </Layout>
  );
}
