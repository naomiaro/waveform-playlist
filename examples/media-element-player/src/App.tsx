import { useEffect, useState } from 'react';
import styled from 'styled-components';
import {
  MediaElementPlaylistProvider,
  MediaElementWaveform,
  loadWaveformData,
  type MediaElementTrackConfig,
} from '@waveform-playlist/browser';
import { Controls } from './Controls';

// Audio + pre-computed `.dat` peaks, served from website/static (Vite publicDir).
const AUDIO_SRC = '/media/audio/AlbertKader_Ubiquitous/08_Bass.opus';
const PEAKS_SRC = '/media/audio/AlbertKader_Ubiquitous/08_Bass.dat';

const Page = styled.div`
  max-width: 980px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
  color: #e6e6ea;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
`;

const Header = styled.header`
  margin-bottom: 1.5rem;

  h1 {
    margin: 0 0 0.4rem;
    color: #d08070;
    font-size: 1.5rem;
    letter-spacing: 0.02em;
  }
  p {
    margin: 0;
    color: #9a9aa6;
    font-size: 0.95rem;
  }
  code {
    font-family: 'Courier New', monospace;
    color: #c49a6c;
  }
`;

const Banner = styled.div`
  padding: 0.9rem 1.1rem;
  border: 1px solid #d08070;
  border-radius: 0.5rem;
  background: rgba(208, 128, 112, 0.12);
  color: #f0c4bb;
  font-size: 0.9rem;
`;

const Status = styled.div`
  padding: 2rem;
  text-align: center;
  color: #9a9aa6;
`;

export function App() {
  const [track, setTrack] = useState<MediaElementTrackConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preservesPitch, setPreservesPitch] = useState(true);

  // Load the pre-computed waveform peaks once, then build the single-track config.
  useEffect(() => {
    let cancelled = false;
    loadWaveformData(PEAKS_SRC)
      .then((waveformData) => {
        if (!cancelled) {
          setTrack({ source: AUDIO_SRC, waveformData, name: 'Bass — AlbertKader “Ubiquitous”' });
        }
      })
      .catch((err) => {
        if (!cancelled) setError('Failed to load waveform data: ' + String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Page>
      <Header>
        <h1>MediaElement starter</h1>
        <p>
          Single-track playback with pitch-preserving speed — no <code>tone</code>, no{' '}
          <code>@waveform-playlist/playout</code>.
        </p>
      </Header>

      {error && <Banner role="alert">{error}</Banner>}

      {!error && !track && <Status>Loading waveform…</Status>}

      {!error && track && (
        <MediaElementPlaylistProvider
          track={track}
          samplesPerPixel={512}
          waveHeight={140}
          preservesPitch={preservesPitch}
          barWidth={2}
          barGap={0}
          timescale
          // New in v14: surface playout-init failures (e.g. a missing peer) to the UI.
          onError={(err) => setError('Playout init failed: ' + err.message)}
        >
          <Controls preservesPitch={preservesPitch} onPreservesPitchChange={setPreservesPitch} />
          <MediaElementWaveform />
        </MediaElementPlaylistProvider>
      )}
    </Page>
  );
}
