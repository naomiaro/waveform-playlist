"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  usePlaylistStore: () => usePlaylistStore
});
module.exports = __toCommonJS(index_exports);

// src/playlistStore.ts
var import_zustand = require("zustand");
var import_immer = require("zustand/middleware/immer");
var import_core = require("@waveform-playlist/core");
var usePlaylistStore = (0, import_zustand.create)()(
  (0, import_immer.immer)((set) => ({
    // Initial state
    tracks: [],
    soloedTracks: /* @__PURE__ */ new Set(),
    mutedTracks: /* @__PURE__ */ new Set(),
    isPlaying: false,
    isPaused: false,
    cursor: 0,
    duration: 0,
    samplesPerPixel: 4096,
    scrollLeft: 0,
    isAutomaticScroll: false,
    selection: void 0,
    interactionState: import_core.InteractionState.Cursor,
    masterGain: 1,
    fadeType: "logarithmic",
    // Track actions
    addTrack: (track) => set((state) => {
      state.tracks.push(track);
      const maxEndTime = Math.max(
        ...state.tracks.map((t) => t.endTime ?? t.startTime)
      );
      state.duration = maxEndTime;
    }),
    removeTrack: (trackId) => set((state) => {
      const index = state.tracks.findIndex((t) => t.id === trackId);
      if (index !== -1) {
        state.tracks.splice(index, 1);
        state.soloedTracks.delete(trackId);
        state.mutedTracks.delete(trackId);
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
    updateTrack: (trackId, updates) => set((state) => {
      const track = state.tracks.find((t) => t.id === trackId);
      if (track) {
        Object.assign(track, updates);
      }
    }),
    // Solo/Mute
    toggleSolo: (trackId) => set((state) => {
      if (state.soloedTracks.has(trackId)) {
        state.soloedTracks.delete(trackId);
      } else {
        state.soloedTracks.add(trackId);
      }
    }),
    toggleMute: (trackId) => set((state) => {
      if (state.mutedTracks.has(trackId)) {
        state.mutedTracks.delete(trackId);
      } else {
        state.mutedTracks.add(trackId);
      }
    }),
    clearSolo: () => set((state) => {
      state.soloedTracks.clear();
    }),
    clearMute: () => set((state) => {
      state.mutedTracks.clear();
    }),
    // Playback controls
    play: () => set((state) => {
      state.isPlaying = true;
      state.isPaused = false;
    }),
    pause: () => set((state) => {
      state.isPlaying = false;
      state.isPaused = true;
    }),
    stop: () => set((state) => {
      state.isPlaying = false;
      state.isPaused = false;
      state.cursor = 0;
    }),
    setCursor: (time) => set((state) => {
      state.cursor = time;
    }),
    // View controls
    setSamplesPerPixel: (spp) => set((state) => {
      state.samplesPerPixel = spp;
    }),
    setScrollLeft: (left) => set((state) => {
      state.scrollLeft = left;
    }),
    setAutomaticScroll: (auto) => set((state) => {
      state.isAutomaticScroll = auto;
    }),
    // Selection
    setSelection: (selection) => set((state) => {
      state.selection = selection;
    }),
    setInteractionState: (interactionState) => set((state) => {
      state.interactionState = interactionState;
    }),
    // Master settings
    setMasterGain: (gain) => set((state) => {
      state.masterGain = gain;
    }),
    setFadeType: (fadeType) => set((state) => {
      state.fadeType = fadeType;
    }),
    // Fades
    addFadeIn: (trackId, start, end) => set((state) => {
      const track = state.tracks.find((t) => t.id === trackId);
      if (track) {
        track.fadeIn = {
          start,
          end,
          type: state.fadeType
        };
      }
    }),
    addFadeOut: (trackId, start, end) => set((state) => {
      const track = state.tracks.find((t) => t.id === trackId);
      if (track) {
        track.fadeOut = {
          start,
          end,
          type: state.fadeType
        };
      }
    }),
    removeFadeIn: (trackId) => set((state) => {
      const track = state.tracks.find((t) => t.id === trackId);
      if (track) {
        track.fadeIn = void 0;
      }
    }),
    removeFadeOut: (trackId) => set((state) => {
      const track = state.tracks.find((t) => t.id === trackId);
      if (track) {
        track.fadeOut = void 0;
      }
    })
  }))
);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  usePlaylistStore
});
//# sourceMappingURL=index.js.map