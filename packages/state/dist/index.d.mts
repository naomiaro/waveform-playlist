import * as immer from 'immer';
import * as zustand from 'zustand';
import { Track, TimeSelection, InteractionState, FadeType } from '@waveform-playlist/core';

interface PlaylistState {
    tracks: Track[];
    soloedTracks: Set<string>;
    mutedTracks: Set<string>;
    isPlaying: boolean;
    isPaused: boolean;
    cursor: number;
    duration: number;
    samplesPerPixel: number;
    scrollLeft: number;
    isAutomaticScroll: boolean;
    selection?: TimeSelection;
    interactionState: InteractionState;
    masterGain: number;
    fadeType: FadeType;
    addTrack: (track: Track) => void;
    removeTrack: (trackId: string) => void;
    updateTrack: (trackId: string, updates: Partial<Track>) => void;
    toggleSolo: (trackId: string) => void;
    toggleMute: (trackId: string) => void;
    clearSolo: () => void;
    clearMute: () => void;
    play: () => void;
    pause: () => void;
    stop: () => void;
    setCursor: (time: number) => void;
    setSamplesPerPixel: (spp: number) => void;
    setScrollLeft: (left: number) => void;
    setAutomaticScroll: (auto: boolean) => void;
    setSelection: (selection?: TimeSelection) => void;
    setInteractionState: (state: InteractionState) => void;
    setMasterGain: (gain: number) => void;
    setFadeType: (fadeType: FadeType) => void;
    addFadeIn: (trackId: string, start: number, end: number) => void;
    addFadeOut: (trackId: string, start: number, end: number) => void;
    removeFadeIn: (trackId: string) => void;
    removeFadeOut: (trackId: string) => void;
}
declare const usePlaylistStore: zustand.UseBoundStore<Omit<zustand.StoreApi<PlaylistState>, "setState"> & {
    setState(nextStateOrUpdater: PlaylistState | Partial<PlaylistState> | ((state: immer.WritableDraft<PlaylistState>) => void), shouldReplace?: boolean | undefined): void;
}>;

export { type PlaylistState, usePlaylistStore };
