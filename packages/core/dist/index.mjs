// src/types/clip.ts
function createClip(options) {
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
  return {
    id: generateId(),
    audioBuffer,
    startTime,
    duration,
    offset,
    gain,
    name,
    color,
    fadeIn,
    fadeOut
  };
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
  const duration = tracks.reduce((maxDuration, track) => {
    const trackDuration = track.clips.reduce((max, clip) => {
      return Math.max(max, clip.startTime + clip.duration);
    }, 0);
    return Math.max(maxDuration, trackDuration);
  }, 0);
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
function getClipsInRange(track, startTime, endTime) {
  return track.clips.filter((clip) => {
    const clipEnd = clip.startTime + clip.duration;
    return clip.startTime < endTime && clipEnd > startTime;
  });
}
function getClipsAtTime(track, time) {
  return track.clips.filter((clip) => {
    const clipEnd = clip.startTime + clip.duration;
    return time >= clip.startTime && time < clipEnd;
  });
}
function clipsOverlap(clip1, clip2) {
  const clip1End = clip1.startTime + clip1.duration;
  const clip2End = clip2.startTime + clip2.duration;
  return clip1.startTime < clip2End && clip1End > clip2.startTime;
}
function sortClipsByTime(clips) {
  return [...clips].sort((a, b) => a.startTime - b.startTime);
}
function findGaps(track) {
  if (track.clips.length === 0) return [];
  const sorted = sortClipsByTime(track.clips);
  const gaps = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const currentClipEnd = sorted[i].startTime + sorted[i].duration;
    const nextClipStart = sorted[i + 1].startTime;
    if (nextClipStart > currentClipEnd) {
      gaps.push({
        startTime: currentClipEnd,
        endTime: nextClipStart,
        duration: nextClipStart - currentClipEnd
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
export {
  InteractionState,
  clipsOverlap,
  createClip,
  createTimeline,
  createTrack,
  findGaps,
  getClipsAtTime,
  getClipsInRange,
  pixelsToSamples,
  pixelsToSeconds,
  samplesToPixels,
  samplesToSeconds,
  secondsToPixels,
  secondsToSamples,
  sortClipsByTime
};
//# sourceMappingURL=index.mjs.map