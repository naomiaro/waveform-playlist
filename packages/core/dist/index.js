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
  InteractionState: () => InteractionState,
  clipsOverlap: () => clipsOverlap,
  createClip: () => createClip,
  createClipFromSeconds: () => createClipFromSeconds,
  createTimeline: () => createTimeline,
  createTrack: () => createTrack,
  findGaps: () => findGaps,
  getClipsAtSample: () => getClipsAtSample,
  getClipsInRange: () => getClipsInRange,
  pixelsToSamples: () => pixelsToSamples,
  pixelsToSeconds: () => pixelsToSeconds,
  samplesToPixels: () => samplesToPixels,
  samplesToSeconds: () => samplesToSeconds,
  secondsToPixels: () => secondsToPixels,
  secondsToSamples: () => secondsToSamples,
  sortClipsByTime: () => sortClipsByTime
});
module.exports = __toCommonJS(index_exports);

// src/types/clip.ts
function createClip(options) {
  const {
    audioBuffer,
    startSample,
    durationSamples = audioBuffer.length,
    // Full buffer by default
    offsetSamples = 0,
    gain = 1,
    name,
    color,
    fadeIn,
    fadeOut
  } = options;
  return {
    id: generateId(),
    audioBuffer,
    startSample,
    durationSamples,
    offsetSamples,
    gain,
    name,
    color,
    fadeIn,
    fadeOut
  };
}
function createClipFromSeconds(options) {
  const {
    audioBuffer,
    startTime,
    duration = audioBuffer.duration,
    offset = 0,
    gain = 1,
    name,
    color,
    fadeIn,
    fadeOut
  } = options;
  const sampleRate = audioBuffer.sampleRate;
  return createClip({
    audioBuffer,
    startSample: Math.round(startTime * sampleRate),
    durationSamples: Math.round(duration * sampleRate),
    offsetSamples: Math.round(offset * sampleRate),
    gain,
    name,
    color,
    fadeIn,
    fadeOut
  });
}
function createTrack(options) {
  const {
    name,
    clips = [],
    muted = false,
    soloed = false,
    volume = 1,
    pan = 0,
    color,
    height
  } = options;
  return {
    id: generateId(),
    name,
    clips,
    muted,
    soloed,
    volume,
    pan,
    color,
    height
  };
}
function createTimeline(tracks, sampleRate = 44100, options) {
  const durationSamples = tracks.reduce((maxSamples, track) => {
    const trackSamples = track.clips.reduce((max, clip) => {
      return Math.max(max, clip.startSample + clip.durationSamples);
    }, 0);
    return Math.max(maxSamples, trackSamples);
  }, 0);
  const duration = durationSamples / sampleRate;
  return {
    tracks,
    duration,
    sampleRate,
    name: options?.name,
    tempo: options?.tempo,
    timeSignature: options?.timeSignature
  };
}
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
function getClipsInRange(track, startSample, endSample) {
  return track.clips.filter((clip) => {
    const clipEnd = clip.startSample + clip.durationSamples;
    return clip.startSample < endSample && clipEnd > startSample;
  });
}
function getClipsAtSample(track, sample) {
  return track.clips.filter((clip) => {
    const clipEnd = clip.startSample + clip.durationSamples;
    return sample >= clip.startSample && sample < clipEnd;
  });
}
function clipsOverlap(clip1, clip2) {
  const clip1End = clip1.startSample + clip1.durationSamples;
  const clip2End = clip2.startSample + clip2.durationSamples;
  return clip1.startSample < clip2End && clip1End > clip2.startSample;
}
function sortClipsByTime(clips) {
  return [...clips].sort((a, b) => a.startSample - b.startSample);
}
function findGaps(track) {
  if (track.clips.length === 0) return [];
  const sorted = sortClipsByTime(track.clips);
  const gaps = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const currentClipEnd = sorted[i].startSample + sorted[i].durationSamples;
    const nextClipStart = sorted[i + 1].startSample;
    if (nextClipStart > currentClipEnd) {
      gaps.push({
        startSample: currentClipEnd,
        endSample: nextClipStart,
        durationSamples: nextClipStart - currentClipEnd
      });
    }
  }
  return gaps;
}

// src/types/index.ts
var InteractionState = /* @__PURE__ */ ((InteractionState2) => {
  InteractionState2["Cursor"] = "cursor";
  InteractionState2["Select"] = "select";
  InteractionState2["Shift"] = "shift";
  InteractionState2["FadeIn"] = "fadein";
  InteractionState2["FadeOut"] = "fadeout";
  return InteractionState2;
})(InteractionState || {});

// src/utils/conversions.ts
function samplesToSeconds(samples, sampleRate) {
  return samples / sampleRate;
}
function secondsToSamples(seconds, sampleRate) {
  return Math.ceil(seconds * sampleRate);
}
function samplesToPixels(samples, samplesPerPixel) {
  return Math.floor(samples / samplesPerPixel);
}
function pixelsToSamples(pixels, samplesPerPixel) {
  return Math.floor(pixels * samplesPerPixel);
}
function pixelsToSeconds(pixels, samplesPerPixel, sampleRate) {
  return pixels * samplesPerPixel / sampleRate;
}
function secondsToPixels(seconds, samplesPerPixel, sampleRate) {
  return Math.ceil(seconds * sampleRate / samplesPerPixel);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InteractionState,
  clipsOverlap,
  createClip,
  createClipFromSeconds,
  createTimeline,
  createTrack,
  findGaps,
  getClipsAtSample,
  getClipsInRange,
  pixelsToSamples,
  pixelsToSeconds,
  samplesToPixels,
  samplesToSeconds,
  secondsToPixels,
  secondsToSamples,
  sortClipsByTime
});
//# sourceMappingURL=index.js.map