// src/index.ts
import { setContext } from "tone";

// src/audioContext.ts
var globalAudioContext = null;
function getGlobalAudioContext() {
  if (!globalAudioContext) {
    globalAudioContext = new AudioContext();
  }
  return globalAudioContext;
}
async function resumeGlobalAudioContext() {
  const context = getGlobalAudioContext();
  if (context.state !== "running") {
    await context.resume();
  }
}
function getGlobalAudioContextState() {
  return globalAudioContext?.state || "suspended";
}
async function closeGlobalAudioContext() {
  if (globalAudioContext && globalAudioContext.state !== "closed") {
    await globalAudioContext.close();
    globalAudioContext = null;
  }
}

// src/TonePlayout.ts
import {
  Volume as Volume2,
  getDestination as getDestination2,
  start,
  now as now2,
  getTransport,
  getContext
} from "tone";

// src/ToneTrack.ts
import {
  Player,
  Volume,
  Gain,
  Panner,
  getDestination,
  now
} from "tone";
import { createFadeIn, createFadeOut } from "fade-maker";
var ToneTrack = class {
  // Count of currently playing clips
  constructor(options) {
    this.activePlayers = 0;
    this.track = options.track;
    this.volumeNode = new Volume(this.gainToDb(options.track.gain));
    this.panNode = new Panner(options.track.stereoPan);
    this.muteGain = new Gain(options.track.muted ? 0 : 1);
    const destination = options.destination || getDestination();
    if (options.effects) {
      const cleanup = options.effects(this.muteGain, destination, false);
      if (cleanup) {
        this.effectsCleanup = cleanup;
      }
    } else {
      this.muteGain.connect(destination);
    }
    const clipInfos = options.clips || (options.buffer ? [{
      buffer: options.buffer,
      startTime: 0,
      // Legacy: single buffer starts at timeline position 0
      duration: options.buffer.duration,
      // Legacy: play full buffer duration
      offset: 0,
      fadeIn: options.track.fadeIn,
      fadeOut: options.track.fadeOut,
      gain: 1
    }] : []);
    this.clips = clipInfos.map((clipInfo) => {
      const player = new Player({
        url: clipInfo.buffer,
        loop: false,
        onstop: () => {
          this.activePlayers--;
          if (this.activePlayers === 0 && this.onStopCallback) {
            this.onStopCallback();
          }
        }
      });
      const fadeGain = new Gain(clipInfo.gain);
      player.connect(fadeGain);
      fadeGain.chain(this.volumeNode, this.panNode, this.muteGain);
      if (clipInfo.fadeIn) {
        const audioParam = fadeGain.gain._param;
        createFadeIn(
          audioParam,
          clipInfo.fadeIn.type,
          clipInfo.fadeIn.start,
          clipInfo.fadeIn.end - clipInfo.fadeIn.start
        );
      }
      if (clipInfo.fadeOut) {
        const audioParam = fadeGain.gain._param;
        createFadeOut(
          audioParam,
          clipInfo.fadeOut.type,
          clipInfo.fadeOut.start,
          clipInfo.fadeOut.end - clipInfo.fadeOut.start
        );
      }
      return {
        player,
        clipInfo,
        fadeGain,
        pausedPosition: 0,
        playStartTime: 0
      };
    });
  }
  gainToDb(gain) {
    return 20 * Math.log10(gain);
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
  play(when = now(), offset = 0, duration) {
    if (this.isPlaying) return;
    this.activePlayers = 0;
    this.clips.forEach((clipPlayer) => {
      const { player, clipInfo } = clipPlayer;
      const playbackPosition = offset;
      const clipStart = clipInfo.startTime;
      const clipEnd = clipInfo.startTime + clipInfo.duration;
      if (isNaN(when) || isNaN(playbackPosition) || isNaN(clipStart) || isNaN(clipInfo.offset) || isNaN(clipInfo.duration)) {
        console.error("NaN detected in ToneTrack.play:", {
          when,
          offset,
          duration,
          playbackPosition,
          clipStart,
          clipEnd,
          clipInfo
        });
      }
      if (playbackPosition < clipEnd) {
        this.activePlayers++;
        clipPlayer.playStartTime = now();
        if (playbackPosition >= clipStart) {
          const clipOffset = playbackPosition - clipStart + clipInfo.offset;
          const remainingDuration = clipInfo.duration - (playbackPosition - clipStart);
          const clipDuration = duration ? Math.min(duration, remainingDuration) : remainingDuration;
          clipPlayer.pausedPosition = clipOffset;
          player.start(when, clipOffset, clipDuration);
        } else {
          const delay = clipStart - playbackPosition;
          const clipDuration = duration ? Math.min(duration - delay, clipInfo.duration) : clipInfo.duration;
          if (delay < (duration ?? Infinity)) {
            clipPlayer.pausedPosition = clipInfo.offset;
            player.start(when + delay, clipInfo.offset, clipDuration);
          } else {
            this.activePlayers--;
          }
        }
      }
    });
  }
  pause() {
    if (!this.isPlaying) return;
    this.clips.forEach((clipPlayer) => {
      if (clipPlayer.player.state === "started") {
        const elapsed = (now() - clipPlayer.playStartTime) * clipPlayer.player.playbackRate;
        clipPlayer.pausedPosition = clipPlayer.pausedPosition + elapsed;
        clipPlayer.player.stop();
      }
    });
    this.activePlayers = 0;
  }
  stop(when = now()) {
    this.clips.forEach((clipPlayer) => {
      clipPlayer.player.stop(when);
      clipPlayer.pausedPosition = 0;
    });
    this.activePlayers = 0;
  }
  dispose() {
    if (this.effectsCleanup) {
      this.effectsCleanup();
    }
    this.clips.forEach((clipPlayer) => {
      clipPlayer.player.dispose();
      clipPlayer.fadeGain.dispose();
    });
    this.volumeNode.dispose();
    this.panNode.dispose();
    this.muteGain.dispose();
  }
  get id() {
    return this.track.id;
  }
  get duration() {
    if (this.clips.length === 0) return 0;
    const lastClip = this.clips[this.clips.length - 1];
    return lastClip.clipInfo.startTime + lastClip.clipInfo.duration;
  }
  get buffer() {
    return this.clips[0]?.clipInfo.buffer;
  }
  get isPlaying() {
    return this.clips.some((clipPlayer) => clipPlayer.player.state === "started");
  }
  get muted() {
    return this.track.muted;
  }
  get startTime() {
    return this.track.startTime;
  }
  setOnStopCallback(callback) {
    this.onStopCallback = callback;
  }
};

// src/TonePlayout.ts
var TonePlayout = class {
  constructor(options = {}) {
    this.tracks = /* @__PURE__ */ new Map();
    this.isInitialized = false;
    this.soloedTracks = /* @__PURE__ */ new Set();
    this.manualMuteState = /* @__PURE__ */ new Map();
    this.activeTracks = /* @__PURE__ */ new Map();
    // Map track ID to session ID
    this.playbackSessionId = 0;
    this.masterVolume = new Volume2(this.gainToDb(options.masterGain ?? 1));
    if (options.effects) {
      const cleanup = options.effects(this.masterVolume, getDestination2(), false);
      if (cleanup) {
        this.effectsCleanup = cleanup;
      }
    } else {
      this.masterVolume.toDestination();
    }
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
    await start();
    this.isInitialized = true;
  }
  addTrack(trackOptions) {
    const optionsWithDestination = {
      ...trackOptions,
      destination: this.masterVolume
    };
    const toneTrack = new ToneTrack(optionsWithDestination);
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
  play(when = now2(), offset, duration) {
    if (!this.isInitialized) {
      console.warn("TonePlayout not initialized. Call init() first.");
      return;
    }
    const playbackPosition = offset ?? 0;
    this.playbackSessionId++;
    const currentSessionId = this.playbackSessionId;
    this.activeTracks.clear();
    this.tracks.forEach((toneTrack) => {
      const trackStartTime = toneTrack.startTime;
      if (playbackPosition >= trackStartTime) {
        const bufferOffset = playbackPosition - trackStartTime;
        if (duration !== void 0) {
          this.activeTracks.set(toneTrack.id, currentSessionId);
          toneTrack.setOnStopCallback(() => {
            if (this.activeTracks.get(toneTrack.id) === currentSessionId) {
              this.activeTracks.delete(toneTrack.id);
              if (this.activeTracks.size === 0 && this.onPlaybackCompleteCallback) {
                this.onPlaybackCompleteCallback();
              }
            }
          });
        }
        toneTrack.play(when, bufferOffset, duration);
      } else {
        const delay = trackStartTime - playbackPosition;
        if (duration !== void 0) {
          this.activeTracks.set(toneTrack.id, currentSessionId);
          toneTrack.setOnStopCallback(() => {
            if (this.activeTracks.get(toneTrack.id) === currentSessionId) {
              this.activeTracks.delete(toneTrack.id);
              if (this.activeTracks.size === 0 && this.onPlaybackCompleteCallback) {
                this.onPlaybackCompleteCallback();
              }
            }
          });
        }
        toneTrack.play(when + delay, 0, duration);
      }
    });
    if (offset !== void 0) {
      getTransport().start(when, offset);
    } else {
      getTransport().start(when);
    }
  }
  pause() {
    getTransport().pause();
    this.tracks.forEach((track) => {
      track.pause();
    });
  }
  stop() {
    getTransport().stop();
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
    return getTransport().seconds;
  }
  seekTo(time) {
    getTransport().seconds = time;
  }
  dispose() {
    this.tracks.forEach((track) => {
      track.dispose();
    });
    this.tracks.clear();
    if (this.effectsCleanup) {
      this.effectsCleanup();
    }
    this.masterVolume.dispose();
  }
  get context() {
    return getContext();
  }
  get sampleRate() {
    return getContext().sampleRate;
  }
  setOnPlaybackComplete(callback) {
    this.onPlaybackCompleteCallback = callback;
  }
};

// src/mediaStreamSourceManager.ts
var streamSources = /* @__PURE__ */ new Map();
var streamCleanupHandlers = /* @__PURE__ */ new Map();
function getMediaStreamSource(stream) {
  if (streamSources.has(stream)) {
    return streamSources.get(stream);
  }
  const context = getGlobalAudioContext();
  const source = context.createMediaStreamSource(stream);
  streamSources.set(stream, source);
  const cleanup = () => {
    source.disconnect();
    streamSources.delete(stream);
    streamCleanupHandlers.delete(stream);
    stream.removeEventListener("ended", cleanup);
    stream.removeEventListener("inactive", cleanup);
  };
  streamCleanupHandlers.set(stream, cleanup);
  stream.addEventListener("ended", cleanup);
  stream.addEventListener("inactive", cleanup);
  return source;
}
function releaseMediaStreamSource(stream) {
  const cleanup = streamCleanupHandlers.get(stream);
  if (cleanup) {
    cleanup();
  }
}
function hasMediaStreamSource(stream) {
  return streamSources.has(stream);
}

// src/index.ts
setContext(getGlobalAudioContext());
export {
  TonePlayout,
  ToneTrack,
  closeGlobalAudioContext,
  getGlobalAudioContext,
  getGlobalAudioContextState,
  getMediaStreamSource,
  hasMediaStreamSource,
  releaseMediaStreamSource,
  resumeGlobalAudioContext
};
//# sourceMappingURL=index.mjs.map