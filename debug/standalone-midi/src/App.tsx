/**
 * Standalone MIDI test — same components as MidiExample.tsx, no Docusaurus.
 * Tests whether the scroll offset bug is Docusaurus-specific.
 */

import React from 'react';
import styled from 'styled-components';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  AudioPosition,
  AutomaticScrollCheckbox,
  WaveformViewOptions,
} from '@waveform-playlist/browser';
import type { WaveformPlaylistTheme } from '@waveform-playlist/ui-components';
import { useMidiTracks } from '@waveform-playlist/midi';
import { SoundFontCache } from '@waveform-playlist/playout';

const darkThemeOverrides: Partial<WaveformPlaylistTheme> = {
  waveformDrawMode: 'inverted',
  waveOutlineColor: {
    type: 'linear',
    direction: 'vertical',
    stops: [
      { offset: 0, color: '#d4a574' },
      { offset: 0.5, color: '#c49a6c' },
      { offset: 1, color: '#d4a574' },
    ],
  },
  waveFillColor: '#1a1612',
  waveProgressColor: 'rgba(100, 70, 40, 0.5)',
  selectedWaveOutlineColor: {
    type: 'linear',
    direction: 'vertical',
    stops: [
      { offset: 0, color: '#e8c090' },
      { offset: 0.5, color: '#d4a87c' },
      { offset: 1, color: '#e8c090' },
    ],
  },
  selectedWaveFillColor: '#241c14',
  playlistBackgroundColor: '#0d0d14',
};

const Controls = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 1rem;
  background: #222;
  border: 1px solid #444;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const InfoBanner = styled.div`
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  border-radius: 0.5rem;
  background: #222;
  border: 1px solid #444;
  font-size: 0.85rem;
  color: #aaa;
`;

const ScrollInfo = styled.div`
  position: fixed;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.9);
  color: #0f0;
  font-family: monospace;
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 4px;
  z-index: 9999;
  border: 1px solid #0f0;
`;

function useSoundFontCache(url?: string): SoundFontCache | undefined {
  const cacheRef = React.useRef<SoundFontCache | null>(null);
  const [cache, setCache] = React.useState<SoundFontCache | undefined>(undefined);

  React.useEffect(() => {
    if (!url) {
      setCache(undefined);
      return;
    }

    let cancelled = false;

    const loadSoundFont = async () => {
      if (cacheRef.current?.isLoaded) {
        setCache(cacheRef.current);
        return;
      }

      const sfCache = new SoundFontCache();

      try {
        await sfCache.load(url);
        if (!cancelled) {
          cacheRef.current = sfCache;
          setCache(sfCache);
        }
      } catch (err) {
        console.warn('[waveform-playlist] Failed to load SoundFont:', err);
      }
    };

    loadSoundFont();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return cache;
}

function ScrollMonitor() {
  const [scrollLeft, setScrollLeft] = React.useState<number | null>(null);

  React.useEffect(() => {
    const check = () => {
      const el = document.querySelector('[data-scroll-container]') as HTMLElement | null;
      if (el) {
        setScrollLeft(el.scrollLeft);
      }
    };

    // Check immediately and on an interval
    check();
    const interval = setInterval(check, 200);

    // Also listen for scroll events
    const handler = () => check();
    const el = document.querySelector('[data-scroll-container]');
    el?.addEventListener('scroll', handler);

    return () => {
      clearInterval(interval);
      el?.removeEventListener('scroll', handler);
    };
  }, []);

  return (
    <ScrollInfo>
      scrollLeft: {scrollLeft !== null ? scrollLeft.toFixed(1) : 'N/A'}
      {scrollLeft !== null && scrollLeft > 0 && ' ⚠️ BUG'}
      {scrollLeft === 0 && ' ✅ OK'}
    </ScrollInfo>
  );
}

export function App() {
  const soundFontCache = useSoundFontCache('/media/soundfont/A320U.sf2');

  const midiConfigs = React.useMemo(
    () => [
      {
        src: '/media/midi/RedHotChiliPeppers-Otherside.mid',
      },
    ],
    []
  );

  const { tracks, loading, error, loadedCount, totalCount } = useMidiTracks(midiConfigs);

  if (error) {
    return (
      <Container>
        <div style={{ padding: '2rem', color: 'red' }}>Error loading MIDI: {error}</div>
      </Container>
    );
  }

  return (
    <Container>
      <h1 style={{ fontSize: '18px', marginBottom: '10px', color: '#e0e0e0' }}>
        Standalone MIDI Test (No Docusaurus)
      </h1>
      <p style={{ fontSize: '12px', color: '#888', marginBottom: '15px' }}>
        Same components as website MIDI example. If scrollLeft shows 0 here but not in Docusaurus,
        the issue is Docusaurus-specific.
      </p>

      <ScrollMonitor />

      <InfoBanner>
        {soundFontCache
          ? 'MIDI tracks use SoundFont sample playback.'
          : 'MIDI tracks are synthesized via Tone.js PolySynth.'}
        {` Showing ${tracks.length} individual MIDI tracks.`}
      </InfoBanner>

      <WaveformPlaylistProvider
        tracks={tracks}
        samplesPerPixel={2048}
        mono
        theme={darkThemeOverrides}
        soundFontCache={soundFontCache}
        automaticScroll
      >
        <Controls>
          <PlayButton />
          <PauseButton />
          <StopButton />
          <AudioPosition />
          {loading && (
            <span style={{ fontSize: '0.875rem', color: '#888' }}>
              Loading ({loadedCount}/{totalCount})...
            </span>
          )}
          <AutomaticScrollCheckbox />
        </Controls>

        <WaveformViewOptions waveHeight={100} progressBarWidth={2}>
          <Waveform />
        </WaveformViewOptions>
      </WaveformPlaylistProvider>
    </Container>
  );
}
