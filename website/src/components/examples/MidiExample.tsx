/**
 * MIDI Playback Example
 *
 * Demonstrates loading a .mid file via @dawcore/midi.
 * Users can drop additional .mid files or click to browse.
 */

import { sitePath } from '../../utils/sitePath';
import React from 'react';
import styled from 'styled-components';
import {
  WaveformPlaylistProvider,
  PlayButton,
  PauseButton,
  StopButton,
  ClearAllButton,
  AudioPosition,
  KeyboardShortcuts,
  usePlaybackControls,
  usePlaylistSettings,
  WaveformRoot,
  WaveformTimescale,
  WaveformLoopRegion,
  WaveformTrackControls,
  DefaultTrackControls,
  TrackRemoveButton,
  WaveformTracks,
  WaveformSelection,
  WaveformPlayhead,
  WaveformViewOptions,
  useCreateArrangement,
  useArrangementTracks,
} from '@waveform-playlist/browser';
import type { WaveformPlaylistTheme } from '@waveform-playlist/ui-components';
import { audioTrack } from '@waveform-playlist/core';
import type { Arrangement } from '@waveform-playlist/engine';
import { loadMidiTracks } from '@dawcore/midi';
import { SoundFontCache, getGlobalAudioContext } from '@waveform-playlist/playout';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { FileDropZone } from '../FileDropZone';
import { FailedDropsAlert, useFailedDrops, type FailedDrop } from './FailedDrops';

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

const lightThemeOverrides: Partial<WaveformPlaylistTheme> = {
  waveformDrawMode: 'normal',
  waveOutlineColor: '#f5f5f5',
  waveFillColor: {
    type: 'linear',
    direction: 'vertical',
    stops: [
      { offset: 0, color: '#3d8b8b' },
      { offset: 0.5, color: '#2a7070' },
      { offset: 1, color: '#3d8b8b' },
    ],
  },
  waveProgressColor: 'rgba(42, 112, 112, 0.3)',
  selectedWaveOutlineColor: '#e8e8e8',
  selectedWaveFillColor: {
    type: 'linear',
    direction: 'vertical',
    stops: [
      { offset: 0, color: '#4a9e9e' },
      { offset: 0.5, color: '#3d8b8b' },
      { offset: 1, color: '#4a9e9e' },
    ],
  },
  playlistBackgroundColor: '#1a1a2e',
};

const Controls = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 1rem;
  background: var(--ifm-background-surface-color, #f8f9fa);
  border: 1px solid var(--ifm-color-emphasis-300, #dee2e6);
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const ToggleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: auto;
`;

const ToggleLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--ifm-color-emphasis-700, #495057);
  user-select: none;
`;

const ToggleSwitch = styled.div<{ $active: boolean }>`
  position: relative;
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: ${(props) =>
    props.$active ? 'var(--ifm-color-primary, #3d8b8b)' : 'var(--ifm-color-emphasis-400, #adb5bd)'};
  transition: background 0.2s;

  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: ${(props) => (props.$active ? '20px' : '2px')};
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: white;
    transition: left 0.2s;
  }
`;

const InfoBanner = styled.div`
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  border-radius: 0.5rem;
  background: var(--ifm-color-emphasis-100, #f1f3f5);
  border: 1px solid var(--ifm-color-emphasis-200, #e9ecef);
  font-size: 0.85rem;
  color: var(--ifm-color-emphasis-700, #495057);
`;

const LoadingOverlay = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  color: var(--ifm-color-emphasis-600, #868e96);
  font-size: 0.9rem;
  gap: 0.5rem;
`;


const StyledDropZone = styled(FileDropZone)`
  margin-top: 1rem;
`;

function AutoScrollToggle() {
  const { isAutomaticScroll } = usePlaylistSettings();
  const { setAutomaticScroll } = usePlaybackControls();

  return (
    <ToggleLabel>
      Auto-scroll
      <ToggleSwitch
        $active={isAutomaticScroll}
        onClick={() => setAutomaticScroll(!isAutomaticScroll)}
      />
    </ToggleLabel>
  );
}

/**
 * Load a SoundFont file and return a SoundFontCache instance.
 * The cache is created once and persists across re-renders.
 */
function useSoundFontCache(url?: string): {
  cache?: SoundFontCache;
  loading: boolean;
  error: string | null;
} {
  const cacheRef = React.useRef<SoundFontCache | null>(null);
  const [cache, setCache] = React.useState<SoundFontCache | undefined>(undefined);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!url) {
      setCache(undefined);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const loadSoundFont = async () => {
      // Reuse existing cache if already loaded
      if (cacheRef.current?.isLoaded) {
        setCache(cacheRef.current);
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        // No context option — SoundFontCache uses OfflineAudioContext
        // internally, which doesn't require user gesture and avoids Firefox's
        // "AudioContext was prevented from starting automatically" warning.
        const sfCache = await SoundFontCache.fromUrl(url);
        if (!cancelled) {
          cacheRef.current = sfCache;
          setCache(sfCache);
          setLoading(false);
        }
      } catch (err) {
        console.warn('[waveform-playlist] Failed to load SoundFont:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load SoundFont');
          setLoading(false);
        }
      }
    };

    loadSoundFont();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { cache, loading, error };
}

const BASE_MIDI_SRC = sitePath('/media/midi/RedHotChiliPeppers-Otherside.mid');

function isMidiFile(file: File): boolean {
  // Check MIME type first, fall back to extension
  if (file.type === 'audio/midi' || file.type === 'audio/x-midi') return true;
  return /\.(mid|midi)$/i.test(file.name);
}

function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') && !isMidiFile(file);
}

const fileBaseName = (file: File): string => file.name.replace(/\.[^/.]+$/, '');

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

type BaseMidiState =
  | { status: 'loading' }
  | { status: 'loaded' }
  | { status: 'failed'; message: string };

/**
 * Loads the page's own .mid file into `arrangement` once: its tracks are
 * added, then the undo history is cleared (the first load is not an undo
 * step), then the status says loaded. A run that is aborted (StrictMode's
 * first run, an unmount) adds nothing.
 */
function useBaseMidi(arrangement: Arrangement): BaseMidiState {
  const [state, setState] = React.useState<BaseMidiState>({ status: 'loading' });
  // Set once the tracks are in: a Fast Refresh runs the effect again and must
  // not add them a second time
  const addedRef = React.useRef(false);

  React.useEffect(() => {
    if (addedRef.current) return undefined;
    const controller = new AbortController();
    loadMidiTracks(BASE_MIDI_SRC, {
      sampleRate: getGlobalAudioContext().sampleRate,
      signal: controller.signal,
    })
      .then((tracks) => {
        if (controller.signal.aborted) return;
        tracks.forEach((track) => arrangement.addTrack(track));
        arrangement.clearHistory();
        addedRef.current = true;
        setState({ status: 'loaded' });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'failed', message: errorMessage(err) });
      });
    return () => controller.abort();
  }, [arrangement]);

  return state;
}

export function MidiExample() {
  const { theme, isDarkMode } = useDocusaurusTheme();
  const gradientTheme = isDarkMode ? darkThemeOverrides : lightThemeOverrides;
  const [useSoundFont, setUseSoundFont] = React.useState(true);

  // Starts empty; the page's .mid file is added once it has loaded, and the
  // provider is rendered only then, so "ready" means the MIDI is in
  const arrangement = useCreateArrangement();
  const baseMidi = useBaseMidi(arrangement);
  const trackCount = useArrangementTracks(arrangement).length;
  // Dropped audio files that could not be decoded: their tracks are removed, the list stays
  const failedAudioDrops = useFailedDrops(arrangement);
  // Dropped .mid files that could not be read
  const [failedMidiDrops, setFailedMidiDrops] = React.useState<readonly FailedDrop[]>([]);
  const failedDrops = React.useMemo(
    () => [...failedAudioDrops, ...failedMidiDrops],
    [failedAudioDrops, failedMidiDrops]
  );

  // Aborts the loads of dropped .mid files when the page unmounts
  const dropsAbortRef = React.useRef<AbortController | null>(null);
  React.useEffect(() => {
    const controller = new AbortController();
    dropsAbortRef.current = controller;
    return () => controller.abort();
  }, []);

  const soundFontUrl = useSoundFont
    ? sitePath('/media/soundfont/A320U.sf2')
    : undefined;
  const {
    cache: soundFontCache,
    loading: soundFontLoading,
    error: soundFontError,
  } = useSoundFontCache(soundFontUrl);

  // A dropped .mid is added as it is (an undo step, like any added track)
  const addMidiFiles = React.useCallback(
    (files: File[]) => {
      const signal = dropsAbortRef.current?.signal;
      files.forEach((file) => {
        const name = fileBaseName(file);
        loadMidiTracks(file, { sampleRate: getGlobalAudioContext().sampleRate, name, signal })
          .then((tracks) => {
            if (signal?.aborted) return;
            tracks.forEach((track) => arrangement.addTrack(track));
          })
          .catch((err: unknown) => {
            if (signal?.aborted) return;
            setFailedMidiDrops((prev) => [...prev, { name, message: errorMessage(err) }]);
          });
      });
    },
    [arrangement]
  );

  // One track per audio file, named after the file without its extension
  const addAudioFiles = React.useCallback(
    (files: File[]) => files.forEach((file) => arrangement.addTrack(audioTrack({ src: file }))),
    [arrangement]
  );

  const handleFiles = React.useCallback(
    (files: File[]) => {
      const midiFiles = files.filter(isMidiFile);
      const audioFiles = files.filter(isAudioFile);
      if (midiFiles.length > 0) addMidiFiles(midiFiles);
      if (audioFiles.length > 0) addAudioFiles(audioFiles);
    },
    [addMidiFiles, addAudioFiles]
  );

  const handleRemoveTrack = React.useCallback(
    (trackId: string) => arrangement.removeTrack(trackId),
    [arrangement]
  );

  // ClearAllButton stops playback first
  const handleClearAll = React.useCallback(() => arrangement.setTracks([]), [arrangement]);

  if (baseMidi.status === 'failed') {
    return (
      <Container>
        <div style={{ padding: '2rem', color: 'red' }}>Error loading MIDI: {baseMidi.message}</div>
      </Container>
    );
  }

  // The loading overlay is shown on the first load only
  const isInitialLoad = baseMidi.status === 'loading';

  if (soundFontLoading || isInitialLoad) {
    return (
      <Container>
        <LoadingOverlay>
          {soundFontLoading && <div>Loading SoundFont...</div>}
          {isInitialLoad && <div>Loading MIDI tracks...</div>}
        </LoadingOverlay>
      </Container>
    );
  }

  return (
    <Container>
      <InfoBanner>
        {soundFontError
          ? `SoundFont failed to load: ${soundFontError}. Falling back to PolySynth synthesis.`
          : soundFontCache
            ? 'MIDI tracks use SoundFont sample playback for realistic instrument sounds.'
            : 'MIDI tracks are synthesized in the browser using Tone.js PolySynth. Notes may be dropped when exceeding the polyphony limit.'}
        {trackCount > 0 &&
          ` Showing ${trackCount} individual MIDI track${trackCount !== 1 ? 's' : ''}.`}
      </InfoBanner>

      {trackCount > 0 ? (
        <WaveformPlaylistProvider
          arrangement={arrangement}
          samplesPerPixel={2048}
          mono
          theme={{ ...theme, ...gradientTheme }}
          soundFontCache={soundFontCache}
          automaticScroll
        >
          <KeyboardShortcuts playback />
          <Controls>
            <PlayButton />
            <PauseButton />
            <StopButton />
            <AudioPosition />
            <ToggleGroup>
              <AutoScrollToggle />
              <ToggleLabel>
                SoundFont
                <ToggleSwitch $active={useSoundFont} onClick={() => setUseSoundFont((s) => !s)} />
              </ToggleLabel>
              <ClearAllButton onClearAll={handleClearAll} />
            </ToggleGroup>
          </Controls>

          <WaveformViewOptions waveHeight={100} progressBarWidth={2}>
            <WaveformRoot>
              <WaveformTimescale />
              <WaveformLoopRegion />
              <WaveformTrackControls>
                <DefaultTrackControls />
                <TrackRemoveButton onRemove={handleRemoveTrack} />
              </WaveformTrackControls>
              <WaveformTracks />
              <WaveformSelection />
              <WaveformPlayhead />
            </WaveformRoot>
          </WaveformViewOptions>
        </WaveformPlaylistProvider>
      ) : (
        <LoadingOverlay>
          <div>All tracks removed.</div>
          <div>Drop a .mid or audio file below, or reload to restore defaults.</div>
        </LoadingOverlay>
      )}

      <StyledDropZone
        accept=".mid,.midi,.mp3,.wav,.ogg,.flac,.aac,.m4a"
        onFiles={handleFiles}
        fileFilter={(file: File) => isMidiFile(file) || isAudioFile(file)}
        label="Drop .mid or audio files here to add tracks, or click to browse"
        dragLabel="Drop MIDI or audio files here"
      />
      <FailedDropsAlert drops={failedDrops} />
    </Container>
  );
}
