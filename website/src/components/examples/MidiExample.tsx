/**
 * MIDI Playback Example
 *
 * Demonstrates loading a .mid file via @waveform-playlist/midi.
 * Users can drop additional .mid files or click to browse.
 */

import React from 'react';
import styled from 'styled-components';
import * as Tone from 'tone';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  ClearAllButton,
  AudioPosition,
  KeyboardShortcuts,
  usePlaylistState,
  usePlaylistControls,
} from '@waveform-playlist/browser';
import type { WaveformPlaylistTheme } from '@waveform-playlist/ui-components';
import { createTrack, createClipFromSeconds } from '@waveform-playlist/core';
import type { ClipTrack } from '@waveform-playlist/core';
import { useMidiTracks } from '@waveform-playlist/midi';
import type { MidiTrackConfig } from '@waveform-playlist/midi';
import { SoundFontCache, getGlobalAudioContext } from '@waveform-playlist/playout';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { FileDropZone } from '../FileDropZone';

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
  const { isAutomaticScroll } = usePlaylistState();
  const { setAutomaticScroll } = usePlaylistControls();

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

      // No AudioContext argument — SoundFontCache uses OfflineAudioContext
      // internally, which doesn't require user gesture and avoids Firefox's
      // "AudioContext was prevented from starting automatically" warning.
      const sfCache = new SoundFontCache();

      try {
        await sfCache.load(url);
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

const BASE_MIDI_SRC = '/waveform-playlist/media/midi/RedHotChiliPeppers-Otherside.mid';

function isMidiFile(file: File): boolean {
  // Check MIME type first, fall back to extension
  if (file.type === 'audio/midi' || file.type === 'audio/x-midi') return true;
  return /\.(mid|midi)$/i.test(file.name);
}

function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') && !isMidiFile(file);
}

export function MidiExample() {
  const { theme, isDarkMode } = useDocusaurusTheme();
  const gradientTheme = isDarkMode ? darkThemeOverrides : lightThemeOverrides;
  const [useSoundFont, setUseSoundFont] = React.useState(true);
  const [baseHidden, setBaseHidden] = React.useState(false);
  const [userMidiConfigs, setUserMidiConfigs] = React.useState<MidiTrackConfig[]>([]);
  const [removedTrackIds, setRemovedTrackIds] = React.useState<Set<string>>(new Set());
  const [userAudioTracks, setUserAudioTracks] = React.useState<ClipTrack[]>([]);
  const objectUrlsRef = React.useRef<string[]>([]);

  const soundFontUrl = useSoundFont
    ? '/waveform-playlist/media/soundfont/A320U.sf2'
    : undefined;
  const {
    cache: soundFontCache,
    loading: soundFontLoading,
    error: soundFontError,
  } = useSoundFontCache(soundFontUrl);

  // Build configs: base (unless hidden) + user-added
  const ctxSampleRate = typeof AudioContext !== 'undefined'
    ? getGlobalAudioContext().sampleRate : 48000;

  const midiConfigs = React.useMemo(() => {
    const configs: MidiTrackConfig[] = [];
    if (!baseHidden) {
      configs.push({ src: BASE_MIDI_SRC, sampleRate: ctxSampleRate });
    }
    configs.push(...userMidiConfigs.map((c) => ({ ...c, sampleRate: c.sampleRate ?? ctxSampleRate })));
    return configs;
  }, [baseHidden, userMidiConfigs, ctxSampleRate]);

  const { tracks: allTracks, loading, error, loadedCount, totalCount } = useMidiTracks(midiConfigs);

  // Merge MIDI + audio tracks and filter out removed ones
  const filteredTracks = React.useMemo(
    () => [...allTracks, ...userAudioTracks].filter((t) => !removedTrackIds.has(t.id)),
    [allTracks, userAudioTracks, removedTrackIds]
  );

  // Revoke object URLs on unmount
  React.useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach(URL.revokeObjectURL);
    };
  }, []);

  const addMidiFiles = React.useCallback((files: File[]) => {
    const midiFiles = files.filter(isMidiFile);
    if (midiFiles.length === 0) return;

    const newConfigs: MidiTrackConfig[] = midiFiles.map((f) => {
      const url = URL.createObjectURL(f);
      objectUrlsRef.current.push(url);
      return {
        src: url,
        name: f.name.replace(/\.[^/.]+$/, ''),
      };
    });
    setUserMidiConfigs((prev) => [...prev, ...newConfigs]);
  }, []);

  const addAudioFiles = React.useCallback(async (files: File[]) => {
    const audioContext = Tone.getContext().rawContext as AudioContext;
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const clip = createClipFromSeconds({
        audioBuffer,
        startTime: 0,
        duration: audioBuffer.duration,
        offset: 0,
      });
      const newTrack = createTrack({
        name: file.name.replace(/\.[^/.]+$/, ''),
        clips: [clip],
      });
      setUserAudioTracks((prev) => [...prev, newTrack]);
    }
  }, []);

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
    (index: number) => {
      const track = filteredTracks[index];
      if (track) {
        setRemovedTrackIds((prev) => new Set([...prev, track.id]));
      }
    },
    [filteredTracks]
  );

  const handleClearAll = React.useCallback(() => {
    objectUrlsRef.current.forEach(URL.revokeObjectURL);
    objectUrlsRef.current = [];
    setBaseHidden(true);
    setUserMidiConfigs([]);
    setUserAudioTracks([]);
    setRemovedTrackIds(new Set());
  }, []);

  if (error) {
    return (
      <Container>
        <div style={{ padding: '2rem', color: 'red' }}>Error loading MIDI: {error}</div>
      </Container>
    );
  }

  // Only show loading overlay on initial load (configs present but tracks not ready)
  const isInitialLoad = midiConfigs.length > 0 && (loading || allTracks.length === 0);
  const isReady = !soundFontLoading && !isInitialLoad;

  if (!isReady) {
    return (
      <Container>
        <LoadingOverlay>
          {soundFontLoading && <div>Loading SoundFont...</div>}
          {isInitialLoad && (
            <div>
              Loading MIDI tracks ({loadedCount}/{totalCount})...
            </div>
          )}
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
        {filteredTracks.length > 0 &&
          ` Showing ${filteredTracks.length} individual MIDI track${filteredTracks.length !== 1 ? 's' : ''}.`}
      </InfoBanner>

      {filteredTracks.length > 0 ? (
        <WaveformPlaylistProvider
          tracks={filteredTracks}
          samplesPerPixel={2048}
          mono
          theme={{ ...theme, ...gradientTheme }}
          soundFontCache={soundFontCache}
          progressBarWidth={2}
          controls={{ show: true, width: 200 }}
          waveHeight={100}
          timescale
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

          <Waveform onRemoveTrack={handleRemoveTrack} />
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
    </Container>
  );
}
