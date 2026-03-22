import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { MidiNoteData } from '@waveform-playlist/core';
import { Midi } from '@tonejs/midi';
import { useMidiTracks, type MidiTrackConfig } from '../useMidiTracks';

/**
 * Helper: create a minimal MIDI ArrayBuffer for testing.
 */
function createTestMidiBuffer(
  tracks: Array<{
    name?: string;
    channel?: number;
    notes: Array<{
      midi: number;
      time: number;
      duration: number;
      velocity?: number;
    }>;
  }>
): ArrayBuffer {
  const midi = new Midi();
  midi.header.setTempo(120);

  for (const trackDef of tracks) {
    const track = midi.addTrack();
    if (trackDef.name) track.name = trackDef.name;
    if (trackDef.channel !== undefined) track.channel = trackDef.channel;
    for (const note of trackDef.notes) {
      track.addNote({
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: note.velocity ?? 0.8,
      });
    }
  }

  return midi.toArray().buffer;
}

// Mock fetch globally
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMidiTracks', () => {
  describe('pre-parsed midiNotes', () => {
    it('creates ClipTrack from pre-parsed notes without fetching', async () => {
      const notes: MidiNoteData[] = [
        { midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 },
        { midi: 64, name: 'E4', time: 0.5, duration: 0.5, velocity: 0.7 },
      ];

      // Stable config reference to avoid useEffect infinite loop
      const configs: MidiTrackConfig[] = [{ midiNotes: notes, name: 'Test', sampleRate: 48000 }];

      const { result } = renderHook(() => useMidiTracks(configs));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.tracks).toHaveLength(1);
      expect(result.current.tracks[0].name).toBe('Test');
      expect(result.current.tracks[0].clips).toHaveLength(1);
      expect(result.current.tracks[0].clips[0].midiNotes).toEqual(notes);
      expect(result.current.error).toBeNull();
    });

    it('applies track config (volume, pan, muted)', async () => {
      const notes: MidiNoteData[] = [
        { midi: 60, name: 'C4', time: 0, duration: 1.0, velocity: 0.8 },
      ];

      const configs: MidiTrackConfig[] = [
        {
          midiNotes: notes,
          name: 'Configured',
          volume: 0.5,
          pan: -0.3,
          muted: true,
          soloed: true,
          color: '#ff0000',
          sampleRate: 48000,
        },
      ];

      const { result } = renderHook(() => useMidiTracks(configs));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const track = result.current.tracks[0];
      expect(track.volume).toBe(0.5);
      expect(track.pan).toBe(-0.3);
      expect(track.muted).toBe(true);
      expect(track.soloed).toBe(true);
      expect(track.color).toBe('#ff0000');
    });

    it('respects startTime and duration overrides', async () => {
      const notes: MidiNoteData[] = [
        { midi: 60, name: 'C4', time: 0, duration: 2.0, velocity: 0.8 },
      ];

      const configs: MidiTrackConfig[] = [
        {
          midiNotes: notes,
          name: 'Positioned',
          startTime: 5.0,
          duration: 10.0,
          sampleRate: 48000,
        },
      ];

      const { result } = renderHook(() => useMidiTracks(configs));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const clip = result.current.tracks[0].clips[0];
      // startSample = round(5.0 * 48000) = 240000
      expect(clip.startSample).toBe(240000);
      // durationSamples = round(10.0 * 48000) = 480000
      expect(clip.durationSamples).toBe(480000);
      expect(clip.sampleRate).toBe(48000);
    });
  });

  describe('fetching from src', () => {
    it('fetches and parses .mid file into ClipTracks', async () => {
      const midiBuffer = createTestMidiBuffer([
        {
          name: 'Piano',
          channel: 0,
          notes: [
            { midi: 60, time: 0, duration: 0.5 },
            { midi: 64, time: 0.5, duration: 0.5 },
          ],
        },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(midiBuffer),
      });

      const configs: MidiTrackConfig[] = [{ src: '/test.mid', name: 'Song', sampleRate: 48000 }];

      const { result } = renderHook(() => useMidiTracks(configs));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/test.mid',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(result.current.tracks).toHaveLength(1);
      expect(result.current.tracks[0].name).toBe('Piano');
      expect(result.current.tracks[0].clips[0].midiNotes).toHaveLength(2);
    });

    it('expands multi-track MIDI into multiple ClipTracks', async () => {
      const midiBuffer = createTestMidiBuffer([
        {
          name: 'Lead',
          channel: 0,
          notes: [{ midi: 72, time: 0, duration: 1.0 }],
        },
        {
          name: 'Bass',
          channel: 1,
          notes: [{ midi: 36, time: 0, duration: 2.0 }],
        },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(midiBuffer),
      });

      const configs: MidiTrackConfig[] = [{ src: '/multi.mid', sampleRate: 48000 }];

      const { result } = renderHook(() => useMidiTracks(configs));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tracks).toHaveLength(2);
      expect(result.current.tracks[0].name).toBe('Lead');
      expect(result.current.tracks[1].name).toBe('Bass');
    });

    it('flattens multi-track MIDI into one ClipTrack', async () => {
      const midiBuffer = createTestMidiBuffer([
        {
          name: 'Lead',
          channel: 0,
          notes: [{ midi: 72, time: 0, duration: 1.0 }],
        },
        {
          name: 'Bass',
          channel: 1,
          notes: [{ midi: 36, time: 0, duration: 2.0 }],
        },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(midiBuffer),
      });

      const configs: MidiTrackConfig[] = [{ src: '/multi.mid', flatten: true, sampleRate: 48000 }];

      const { result } = renderHook(() => useMidiTracks(configs));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tracks).toHaveLength(1);
      expect(result.current.tracks[0].clips[0].midiNotes).toHaveLength(2);
    });
  });

  describe('loading states', () => {
    it('starts in loading state', () => {
      mockFetch.mockReturnValue(new Promise(() => {})); // never resolves

      const configs: MidiTrackConfig[] = [{ src: '/test.mid', sampleRate: 48000 }];

      const { result } = renderHook(() => useMidiTracks(configs));

      expect(result.current.loading).toBe(true);
      expect(result.current.loadedCount).toBe(0);
      expect(result.current.totalCount).toBe(1);
    });

    it('handles empty configs', async () => {
      const configs: MidiTrackConfig[] = [];

      const { result } = renderHook(() => useMidiTracks(configs));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tracks).toHaveLength(0);
      expect(result.current.loadedCount).toBe(0);
      expect(result.current.totalCount).toBe(0);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('sets error on fetch failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      const configs: MidiTrackConfig[] = [{ src: '/missing.mid', sampleRate: 48000 }];

      const { result } = renderHook(() => useMidiTracks(configs));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toContain('Failed to fetch');
      expect(result.current.tracks).toHaveLength(0);
    });

    it('sets error when neither src nor midiNotes provided', async () => {
      const configs: MidiTrackConfig[] = [{ name: 'Invalid', sampleRate: 48000 }];

      const { result } = renderHook(() => useMidiTracks(configs));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toContain('must provide src or midiNotes');
    });
  });

  describe('cleanup', () => {
    it('aborts fetch on unmount', async () => {
      let abortSignal: AbortSignal | null | undefined;
      mockFetch.mockImplementation((_url: string, init?: RequestInit) => {
        abortSignal = init?.signal;
        return new Promise(() => {}); // never resolves
      });

      const configs: MidiTrackConfig[] = [{ src: '/test.mid', sampleRate: 48000 }];

      const { unmount } = renderHook(() => useMidiTracks(configs));

      // Wait for fetch to be called
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      unmount();

      expect(abortSignal?.aborted).toBe(true);
    });
  });

  describe('batch loading', () => {
    it('returns all tracks at once after loading completes', async () => {
      const notes1: MidiNoteData[] = [
        { midi: 60, name: 'C4', time: 0, duration: 1.0, velocity: 0.8 },
      ];
      const notes2: MidiNoteData[] = [
        { midi: 72, name: 'C5', time: 0, duration: 1.0, velocity: 0.8 },
      ];

      const configs: MidiTrackConfig[] = [
        { midiNotes: notes1, name: 'Track 1', sampleRate: 48000 },
        { midiNotes: notes2, name: 'Track 2', sampleRate: 48000 },
      ];

      const { result } = renderHook(() => useMidiTracks(configs));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tracks).toHaveLength(2);
      expect(result.current.loadedCount).toBe(2);
      expect(result.current.totalCount).toBe(2);
    });
  });
});
