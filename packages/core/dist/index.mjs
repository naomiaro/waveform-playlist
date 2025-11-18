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
  pixelsToSamples,
  pixelsToSeconds,
  samplesToPixels,
  samplesToSeconds,
  secondsToPixels,
  secondsToSamples
};
//# sourceMappingURL=index.mjs.map