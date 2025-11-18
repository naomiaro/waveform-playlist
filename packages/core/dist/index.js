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
  pixelsToSamples: () => pixelsToSamples,
  pixelsToSeconds: () => pixelsToSeconds,
  samplesToPixels: () => samplesToPixels,
  samplesToSeconds: () => samplesToSeconds,
  secondsToPixels: () => secondsToPixels,
  secondsToSamples: () => secondsToSamples
});
module.exports = __toCommonJS(index_exports);

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
  pixelsToSamples,
  pixelsToSeconds,
  samplesToPixels,
  samplesToSeconds,
  secondsToPixels,
  secondsToSamples
});
//# sourceMappingURL=index.js.map