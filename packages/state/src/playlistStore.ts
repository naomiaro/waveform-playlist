import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Track, TimeSelection, InteractionState, FadeType } from '@waveform-playlist/core';

export interface PlaylistState {
  // Tracks
  tracks: Track[];
  soloedTracks: Set<string>;
  mutedTracks: Set<string>;

  // Playback
  isPlaying: boolean;
  isPaused: boolean;
  cursor: number;
  duration: number;

  // View settings
  samplesPerPixel: number;
  scrollLeft: number;
  isAutomaticScroll: boolean;

  // Selection
  selection?: TimeSelection;
  interactionState: InteractionState;

  // Master settings
  masterGain: number;
  fadeType: FadeType;

  // Actions
  addTrack: (track: Track) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;

  // Solo/Mute
  toggleSolo: (trackId: string) => void;
  toggleMute: (trackId: string) => void;
  clearSolo: () => void;
  clearMute: () => void;

  // Playback controls
  play: () => void;
  pause: () => void;
  stop: () => void;
  setCursor: (time: number) => void;

  // View controls
  setSamplesPerPixel: (spp: number) => void;
  setScrollLeft: (left: number) => void;
  setAutomaticScroll: (auto: boolean) => void;

  // Selection
  setSelection: (selection?: TimeSelection) => void;
  setInteractionState: (state: InteractionState) => void;

  // Master settings
  setMasterGain: (gain: number) => void;
  setFadeType: (fadeType: FadeType) => void;

  // Fades
  addFadeIn: (trackId: string, start: number, end: number) => void;
  addFadeOut: (trackId: string, start: number, end: number) => void;
  removeFadeIn: (trackId: string) => void;
  removeFadeOut: (trackId: string) => void;
}

export const usePlaylistStore = create<PlaylistState>()(
  immer((set) => ({
    // Initial state
    tracks: [],
    soloedTracks: new Set(),
    mutedTracks: new Set(),

    isPlaying: false,
    isPaused: false,
    cursor: 0,
    duration: 0,

    samplesPerPixel: 4096,
    scrollLeft: 0,
    isAutomaticScroll: false,

    selection: undefined,
    interactionState: InteractionState.Cursor,

    masterGain: 1,
    fadeType: 'logarithmic',

    // Track actions
    addTrack: (track) =>
      set((state) => {
        state.tracks.push(track);
        // Recalculate duration
        const maxEndTime = Math.max(
          ...state.tracks.map((t) => t.endTime ?? t.startTime)
        );
        state.duration = maxEndTime;
      }),

    removeTrack: (trackId) =>
      set((state) => {
        const index = state.tracks.findIndex((t) => t.id === trackId);
        if (index !== -1) {
          state.tracks.splice(index, 1);
          state.soloedTracks.delete(trackId);
          state.mutedTracks.delete(trackId);
          // Recalculate duration
          if (state.tracks.length > 0) {
            const maxEndTime = Math.max(
              ...state.tracks.map((t) => t.endTime ?? t.startTime)
            );
            state.duration = maxEndTime;
          } else {
            state.duration = 0;
          }
        }
      }),

    updateTrack: (trackId, updates) =>
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          Object.assign(track, updates);
        }
      }),

    // Solo/Mute
    toggleSolo: (trackId) =>
      set((state) => {
        if (state.soloedTracks.has(trackId)) {
          state.soloedTracks.delete(trackId);
        } else {
          state.soloedTracks.add(trackId);
        }
      }),

    toggleMute: (trackId) =>
      set((state) => {
        if (state.mutedTracks.has(trackId)) {
          state.mutedTracks.delete(trackId);
        } else {
          state.mutedTracks.add(trackId);
        }
      }),

    clearSolo: () =>
      set((state) => {
        state.soloedTracks.clear();
      }),

    clearMute: () =>
      set((state) => {
        state.mutedTracks.clear();
      }),

    // Playback controls
    play: () =>
      set((state) => {
        state.isPlaying = true;
        state.isPaused = false;
      }),

    pause: () =>
      set((state) => {
        state.isPlaying = false;
        state.isPaused = true;
      }),

    stop: () =>
      set((state) => {
        state.isPlaying = false;
        state.isPaused = false;
        state.cursor = 0;
      }),

    setCursor: (time) =>
      set((state) => {
        state.cursor = time;
      }),

    // View controls
    setSamplesPerPixel: (spp) =>
      set((state) => {
        state.samplesPerPixel = spp;
      }),

    setScrollLeft: (left) =>
      set((state) => {
        state.scrollLeft = left;
      }),

    setAutomaticScroll: (auto) =>
      set((state) => {
        state.isAutomaticScroll = auto;
      }),

    // Selection
    setSelection: (selection) =>
      set((state) => {
        state.selection = selection;
      }),

    setInteractionState: (interactionState) =>
      set((state) => {
        state.interactionState = interactionState;
      }),

    // Master settings
    setMasterGain: (gain) =>
      set((state) => {
        state.masterGain = gain;
      }),

    setFadeType: (fadeType) =>
      set((state) => {
        state.fadeType = fadeType;
      }),

    // Fades
    addFadeIn: (trackId, start, end) =>
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          track.fadeIn = {
            start,
            end,
            type: state.fadeType,
          };
        }
      }),

    addFadeOut: (trackId, start, end) =>
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          track.fadeOut = {
            start,
            end,
            type: state.fadeType,
          };
        }
      }),

    removeFadeIn: (trackId) =>
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          track.fadeIn = undefined;
        }
      }),

    removeFadeOut: (trackId) =>
      set((state) => {
        const track = state.tracks.find((t) => t.id === trackId);
        if (track) {
          track.fadeOut = undefined;
        }
      }),
  }))
);
