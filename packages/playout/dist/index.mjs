// src/TonePlayout.ts
import * as Tone2 from "tone";

// src/ToneTrack.ts
import * as Tone from "tone";
import { createFadeIn, createFadeOut } from "fade-maker";
var ToneTrack = class {
  constructor(options) {
    this.pausedPosition = 0;
    this.playStartTime = 0;
    this.track = options.track;
    this.audioBuffer = options.buffer;
    this.player = new Tone.Player({
      url: options.buffer,
      loop: false
    });
    this.fadeGain = new Tone.Gain(1);
    this.volumeNode = new Tone.Volume(this.gainToDb(options.track.gain));
    this.panNode = new Tone.Panner(options.track.stereoPan);
    this.muteGain = new Tone.Gain(options.track.muted ? 0 : 1);
    this.player.chain(
      this.fadeGain,
      this.volumeNode,
      this.panNode,
      this.muteGain,
      Tone.getDestination()
    );
    if (options.track.fadeIn) {
      this.applyFadeIn(
        options.track.fadeIn.start,
        options.track.fadeIn.end - options.track.fadeIn.start,
        options.track.fadeIn.type
      );
    }
    if (options.track.fadeOut) {
      this.applyFadeOut(
        options.track.fadeOut.start,
        options.track.fadeOut.end - options.track.fadeOut.start,
        options.track.fadeOut.type
      );
    }
  }
  gainToDb(gain) {
    return 20 * Math.log10(gain);
  }
  applyFadeIn(start2, duration, shape = "logarithmic") {
    const audioParam = this.fadeGain.gain._param;
    createFadeIn(audioParam, shape, start2, duration);
  }
  applyFadeOut(start2, duration, shape = "logarithmic") {
    const audioParam = this.fadeGain.gain._param;
    createFadeOut(audioParam, shape, start2, duration);
  }
  setVolume(gain) {
    this.track.gain = gain;
    this.volumeNode.volume.value = this.gainToDb(gain);
  }
  setPan(pan) {
    this.track.stereoPan = pan;
    this.panNode.pan.value = pan;
  }
  setMute(muted) {
    this.track.muted = muted;
    this.muteGain.gain.value = muted ? 0 : 1;
  }
  setSolo(soloed) {
    this.track.soloed = soloed;
  }
  play(when = Tone.now(), offset = 0, duration) {
    if (this.isPlaying) return;
    this.playStartTime = Tone.now();
    const startTime = this.track.startTime + this.pausedPosition + offset;
    const playDuration = duration ?? (this.track.endTime ? this.track.endTime - startTime : void 0);
    if (playDuration !== void 0) {
      this.player.start(when, startTime, playDuration);
    } else {
      this.player.start(when, startTime);
    }
  }
  pause() {
    if (!this.isPlaying) return;
    const elapsed = (Tone.now() - this.playStartTime) * this.player.playbackRate;
    this.pausedPosition = this.pausedPosition + elapsed;
    this.player.stop();
  }
  stop(when = Tone.now()) {
    this.player.stop(when);
    this.pausedPosition = 0;
  }
  dispose() {
    this.player.dispose();
    this.volumeNode.dispose();
    this.panNode.dispose();
    this.fadeGain.dispose();
    this.muteGain.dispose();
  }
  get id() {
    return this.track.id;
  }
  get duration() {
    return this.audioBuffer.duration;
  }
  get buffer() {
    return this.audioBuffer;
  }
  get isPlaying() {
    return this.player.state === "started";
  }
  get muted() {
    return this.track.muted;
  }
};

// src/TonePlayout.ts
var TonePlayout = class {
  constructor(options = {}) {
    this.tracks = /* @__PURE__ */ new Map();
    this.isInitialized = false;
    this.soloedTracks = /* @__PURE__ */ new Set();
    this.manualMuteState = /* @__PURE__ */ new Map();
    this.masterVolume = new Tone2.Volume(this.gainToDb(options.masterGain ?? 1));
    this.masterVolume.toDestination();
    if (options.tracks) {
      options.tracks.forEach((track) => {
        this.tracks.set(track.id, track);
        this.manualMuteState.set(track.id, track.muted);
      });
    }
  }
  gainToDb(gain) {
    return 20 * Math.log10(gain);
  }
  async init() {
    if (this.isInitialized) return;
    await Tone2.start();
    this.isInitialized = true;
  }
  addTrack(trackOptions) {
    const toneTrack = new ToneTrack(trackOptions);
    this.tracks.set(toneTrack.id, toneTrack);
    this.manualMuteState.set(toneTrack.id, trackOptions.track.muted ?? false);
    return toneTrack;
  }
  removeTrack(trackId) {
    const track = this.tracks.get(trackId);
    if (track) {
      track.dispose();
      this.tracks.delete(trackId);
      this.manualMuteState.delete(trackId);
      this.soloedTracks.delete(trackId);
    }
  }
  getTrack(trackId) {
    return this.tracks.get(trackId);
  }
  play(when = Tone2.now(), offset) {
    if (!this.isInitialized) {
      console.warn("TonePlayout not initialized. Call init() first.");
      return;
    }
    this.tracks.forEach((track) => {
      track.play(when, offset);
    });
    if (offset !== void 0) {
      Tone2.getTransport().start(when, offset);
    } else {
      Tone2.getTransport().start(when);
    }
  }
  pause() {
    Tone2.getTransport().pause();
    this.tracks.forEach((track) => {
      track.pause();
    });
  }
  stop() {
    Tone2.getTransport().stop();
    this.tracks.forEach((track) => {
      track.stop();
    });
  }
  setMasterGain(gain) {
    this.masterVolume.volume.value = this.gainToDb(gain);
  }
  setSolo(trackId, soloed) {
    const track = this.tracks.get(trackId);
    if (track) {
      track.setSolo(soloed);
      if (soloed) {
        this.soloedTracks.add(trackId);
      } else {
        this.soloedTracks.delete(trackId);
      }
      this.updateSoloMuting();
    }
  }
  updateSoloMuting() {
    const hasSoloedTracks = this.soloedTracks.size > 0;
    this.tracks.forEach((track, id) => {
      if (hasSoloedTracks) {
        if (!this.soloedTracks.has(id)) {
          track.setMute(true);
        } else {
          const manuallyMuted = this.manualMuteState.get(id) ?? false;
          track.setMute(manuallyMuted);
        }
      } else {
        const manuallyMuted = this.manualMuteState.get(id) ?? false;
        track.setMute(manuallyMuted);
      }
    });
  }
  setMute(trackId, muted) {
    const track = this.tracks.get(trackId);
    if (track) {
      this.manualMuteState.set(trackId, muted);
      track.setMute(muted);
    }
  }
  getCurrentTime() {
    return Tone2.getTransport().seconds;
  }
  seekTo(time) {
    Tone2.getTransport().seconds = time;
  }
  dispose() {
    this.tracks.forEach((track) => {
      track.dispose();
    });
    this.tracks.clear();
    this.masterVolume.dispose();
  }
  get context() {
    return Tone2.getContext();
  }
  get sampleRate() {
    return Tone2.getContext().sampleRate;
  }
};
export {
  TonePlayout,
  ToneTrack
};
//# sourceMappingURL=index.mjs.map