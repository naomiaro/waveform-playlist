import _defaults from "lodash.defaultsdeep";

import h from "virtual-dom/h";
import diff from "virtual-dom/diff";
import patch from "virtual-dom/patch";
import InlineWorker from "inline-worker";
import { secondsToPixels, pixelsToSeconds } from "./utils/conversions";
import { resampleAudioBuffer } from "./utils/audioData";
import LoaderFactory from "./track/loader/LoaderFactory";
import ScrollHook from "./render/ScrollHook";
import VolumeSliderHook from "./render/VolumeSliderHook";
import TimeScale from "./TimeScale";
import Track from "./Track";
import Lane from "./Lane";
import Playout from "./Playout";
import AnnotationList from "./annotation/AnnotationList";

import RecorderWorkerFunction from "./utils/recorderWorker";
import ExportWavWorkerFunction from "./utils/exportWavWorker";

export default class {
  constructor() {
    this.tracks = [];
    this.lanes = [];
    this.soloedTracks = [];
    this.mutedTracks = [];
    this.collapsedTracks = [];
    this.playoutPromises = [];

    this.cursor = 0;
    this.playbackSeconds = 0;
    this.duration = 0;
    this.scrollLeft = 0;
    this.scrollTimer = undefined;
    this.showTimescale = false;
    // whether a user is scrolling the waveform
    this.isScrolling = false;

    this.fadeType = "logarithmic";
    this.masterGain = 1;
    this.annotations = [];
    this.durationFormat = "hh:mm:ss.uuu";
    this.isAutomaticScroll = false;
    this.resetDrawTimer = undefined;
  }

  // TODO extract into a plugin
  initExporter() {
    this.exportWorker = new InlineWorker(ExportWavWorkerFunction);
  }

  // TODO extract into a plugin
  initRecorder(stream) {
    this.mediaRecorder = new MediaRecorder(stream);

    this.mediaRecorder.onstart = () => {
      const track = new Track();
      track.setName("Recording");
      track.setEnabledStates();
      track.setEventEmitter(this.ee);

      this.recordingTrack = track;
      this.tracks.push(track);

      this.chunks = [];
      this.working = false;
    };

    this.mediaRecorder.ondataavailable = (e) => {
      this.chunks.push(e.data);

      // throttle peaks calculation
      if (!this.working) {
        const recording = new Blob(this.chunks, {
          type: "audio/ogg; codecs=opus",
        });
        const loader = LoaderFactory.createLoader(recording, this.ac);
        loader
          .load()
          .then((audioBuffer) => {
            // ask web worker for peaks.
            this.recorderWorker.postMessage({
              samples: audioBuffer.getChannelData(0),
              samplesPerPixel: this.samplesPerPixel,
            });
            this.recordingTrack.setCues(0, audioBuffer.duration);
            this.recordingTrack.setBuffer(audioBuffer);
            this.recordingTrack.setPlayout(
              new Playout(this.ac, audioBuffer, this.masterGainNode)
            );
            this.adjustDuration();
          })
          .catch(() => {
            this.working = false;
          });
        this.working = true;
      }
    };

    this.mediaRecorder.onstop = () => {
      this.chunks = [];
      this.working = false;
    };

    this.recorderWorker = new InlineWorker(RecorderWorkerFunction);
    // use a worker for calculating recording peaks.
    this.recorderWorker.onmessage = (e) => {
      this.recordingTrack.setPeaks(e.data);
      this.working = false;
      this.drawRequest();
    };
  }

  setShowTimeScale(show) {
    this.showTimescale = show;
  }

  setMono(mono) {
    this.mono = mono;
  }

  setExclSolo(exclSolo) {
    this.exclSolo = exclSolo;
  }

  setSeekStyle(style) {
    this.seekStyle = style;
  }

  getSeekStyle() {
    return this.seekStyle;
  }

  setSampleRate(sampleRate) {
    this.sampleRate = sampleRate;
  }

  setSamplesPerPixel(samplesPerPixel) {
    this.samplesPerPixel = samplesPerPixel;
  }

  setAudioContext(ac) {
    this.ac = ac;
    this.masterGainNode = ac.createGain();
  }

  getAudioContext() {
    return this.ac;
  }

  setControlOptions(controlOptions) {
    this.controls = controlOptions;
  }

  setWaveHeight(height) {
    this.waveHeight = height;
  }

  setCollapsedWaveHeight(height) {
    this.collapsedWaveHeight = height;
  }

  setColors(colors) {
    this.colors = colors;
  }

  setBarWidth(width) {
    this.barWidth = width;
  }

  setBarGap(width) {
    this.barGap = width;
  }

  setAnnotations(config) {
    const controlWidth = this.controls.show ? this.controls.width : 0;
    this.annotationList = new AnnotationList(
      this,
      config.annotations,
      config.controls,
      config.editable,
      config.linkEndpoints,
      config.isContinuousPlay,
      controlWidth
    );
  }

  setEffects(effectsGraph) {
    this.effectsGraph = effectsGraph;
  }

  setEventEmitter(ee) {
    this.ee = ee;
  }

  getEventEmitter() {
    return this.ee;
  }

  setUpEventEmitter() {
    const ee = this.ee;

    ee.on("automaticscroll", (val) => {
      this.isAutomaticScroll = val;
    });

    ee.on("durationformat", (format) => {
      this.durationFormat = format;
      this.drawRequest();
    });

    ee.on("select", (start, end, track) => {
      if (this.isPlaying()) {
        this.lastSeeked = start;
        this.pausedAt = undefined;
        this.restartPlayFrom(start);
      } else {
        // reset if it was paused.
        this.seek(start, end, track);
        this.ee.emit("timeupdate", start);
        this.drawRequest();
      }
    });

    ee.on("startaudiorendering", (type) => {
      this.startOfflineRender(type);
    });

    ee.on("statechange", (state) => {
      this.setState(state);
      this.drawRequest();
    });

    ee.on("shift", (deltaTime, track, lastShift) => {
      let newStartTime = track.getStartTime() + deltaTime;
      if (lastShift) {
        if (newStartTime < 0) {
          newStartTime = 0;
        }
        if (this.isPlaying()) {
          this.pause();
          this.play();
        }
      }
      track.setStartTime(newStartTime);
      this.lanes.forEach((lane) => {
        const endTime =
          lane.tracks.length > 0
            ? Math.max(...lane.tracks.map((track) => track.endTime))
            : 0;
        lane.setEndTime(endTime);
      });
      this.adjustDuration();
      this.drawRequest();
    });

    ee.on("record", () => {
      this.record();
    });

    ee.on("play", (start, end) => {
      this.play(start, end);
    });

    ee.on("pause", () => {
      this.pause();
    });

    ee.on("stop", () => {
      this.stop();
    });

    ee.on("rewind", () => {
      this.rewind();
    });

    ee.on("fastforward", () => {
      this.fastForward();
    });

    ee.on("clear", () => {
      this.clear().then(() => {
        this.drawRequest();
      });
    });

    ee.on("solo", (track) => {
      this.soloTrack(track);
      this.adjustTrackPlayout();
      this.drawRequest();
    });

    ee.on("mute", (track) => {
      this.muteTrack(track);
      this.adjustTrackPlayout();
      this.drawRequest();
    });

    ee.on("removeTrack", (track) => {
      this.removeTrack(track);
      this.adjustTrackPlayout();
      this.drawRequest();
    });

    ee.on("renameTrack", (track) => {
      this.renameTrack(track);
    });

    ee.on("changeTrackView", (track, opts) => {
      this.collapseTrack(track, opts);
      this.drawRequest();
    });

    ee.on("volumechange", (volume, track) => {
      track.setGainLevel(volume / 100);
      this.drawRequest();
    });

    ee.on("mastervolumechange", (volume) => {
      this.masterGain = volume / 100;
      this.tracks.forEach((track) => {
        track.setMasterGainLevel(this.masterGain);
      });
    });

    ee.on("fadein", (duration, track) => {
      this.ee.emit(
        "createFadeUndoStep",
        "fadeIn",
        this.fadeType,
        duration,
        track
      );
    });

    ee.on("createFadeIn", (fadeObject) => {
      const track = this.getTrackByCustomID(fadeObject.track.customID);
      track.setFadeIn(fadeObject.duration, fadeObject.fadeType);
      this.drawRequest();
    });

    ee.on("fadeout", (duration, track) => {
      this.ee.emit(
        "createFadeUndoStep",
        "fadeOut",
        this.fadeType,
        duration,
        track
      );
    });

    ee.on("createFadeOut", (fadeObject) => {
      const track = this.getTrackByCustomID(fadeObject.track.customID);
      track.setFadeOut(fadeObject.duration, fadeObject.fadeType);
      this.drawRequest();
    });

    ee.on("stereopan", (panvalue, track) => {
      track.setStereoPanValue(panvalue);
      this.drawRequest();
    });

    ee.on("fadetype", (type) => {
      this.fadeType = type;
    });

    ee.on("newtrack", (file) => {
      this.load([
        {
          src: file,
          name: `Track ${this.tracks.length + 1}`,
        },
      ]);
    });

    ee.on("cut", () => {
      const track = this.getActiveTrack();
      const timeSelection = this.getTimeSelection();

      track.removePart(timeSelection.start, timeSelection.end, this.ac, track);
      track.calculatePeaks(this.samplesPerPixel, this.sampleRate);

      this.setTimeSelection(0, 0);
      this.adjustDuration();
      this.drawRequest();
      this.ee.emit("cutfinished");
    });

    ee.on("loadTrackBuffer", (bufferAndTrackObject) => {
      const track = this.getTrackByCustomID(
        bufferAndTrackObject.track.customID
      );
      const buffer = bufferAndTrackObject.buffer;
      track.changeBuffer(buffer);
      track.calculatePeaks(this.samplesPerPixel, this.sampleRate);
      this.setTimeSelection(0, 0);
      this.adjustDuration();
      this.drawRequest();
      this.ee.emit("trackbufferloaded");
      if (
        typeof track.fades !== "undefined" &&
        Object.keys(track.fades).length > 0
      ) {
        let fades = track.fades;
        let fadeInDuration = 0,
          fadeOutDuration = 0;
        Object.keys(fades).forEach((key) => {
          if (fades[key].type === "FadeIn") {
            fadeInDuration = fades[key].end - fades[key].start;
          } else if (fades[key].type === "FadeOut") {
            fadeOutDuration = fades[key].end - fades[key].start;
          }
        });
        let totalFadesDuration = fadeInDuration + fadeOutDuration;
        if (totalFadesDuration >= buffer.duration) {
          // Only remove fades if they will intersect or be longer than new arrayBuffer after cut
          if (track.fadeIn) {
            track.removeFade(track.fadeIn);
            track.fadeIn = undefined;
          }
          if (track.fadeOut) {
            track.removeFade(track.fadeOut);
            track.fadeOut = undefined;
          }
        }
      }
    });

    ee.on("trim", () => {
      const track = this.getActiveTrack();
      const timeSelection = this.getTimeSelection();

      track.trim(timeSelection.start, timeSelection.end);
      track.calculatePeaks(this.samplesPerPixel, this.sampleRate);

      this.setTimeSelection(0, 0);
      this.drawRequest();
    });

    ee.on("split", () => {
      const track = this.getActiveTrack();
      const timeSelection = this.getTimeSelection();
      const timeSelectionStart = timeSelection.start;
      this.createTrackFromSplit({
        trackToSplit: track,
        name: track.name + "_1",
        splitTime: timeSelectionStart,
      });
      track.trim(track.startTime, timeSelectionStart);
      if (track.fadeOut) {
        track.removeFade(track.fadeOut);
        track.fadeOut = undefined;
      }

      track.calculatePeaks(this.samplesPerPixel, this.sampleRate);
      this.drawRequest();
    });

    ee.on("zoomin", () => {
      const zoomIndex = Math.max(0, this.zoomIndex - 1);
      const zoom = this.zoomLevels[zoomIndex];

      if (zoom !== this.samplesPerPixel) {
        this.setZoom(zoom);
        this.drawRequest();
      }
    });

    ee.on("zoomout", () => {
      const zoomIndex = Math.min(
        this.zoomLevels.length - 1,
        this.zoomIndex + 1
      );
      const zoom = this.zoomLevels[zoomIndex];

      if (zoom !== this.samplesPerPixel) {
        this.setZoom(zoom);
        this.drawRequest();
      }
    });

    ee.on("scroll", () => {
      this.isScrolling = true;
      this.drawRequest();
      clearTimeout(this.scrollTimer);
      this.scrollTimer = setTimeout(() => {
        this.isScrolling = false;
      }, 200);
    });

    ee.on("loadFadeStates", (fadeStateObject) => {
      let prevFades = fadeStateObject.fades;
      const track = this.getTrackByCustomID(fadeStateObject.track.customID);
      if (!fadeStateObject.redo) {
        let redoFades = {
          fades: JSON.parse(JSON.stringify(track.fades)),
          track: track,
          type: "fade",
        };
        this.ee.emit("saveFadeRedo", redoFades);
      }
      if (
        typeof prevFades !== "undefined" &&
        Object.keys(prevFades).length > 0
      ) {
        let fades = prevFades;
        if (fades) {
          let whichFades = [];
          Object.keys(fades).forEach((key) => {
            if (fades[key].type === "FadeIn") {
              whichFades.push("FadeIn");
              let duration = fades[key].end - fades[key].start;
              let fadeType = fades[key].shape;
              track.setFadeIn(duration, fadeType);
            } else if (fades[key].type === "FadeOut") {
              whichFades.push("FadeOut");
              let duration = fades[key].end - fades[key].start;
              let fadeType = fades[key].shape;
              track.setFadeOut(duration, fadeType);
            }
          });
          if (!whichFades.includes("FadeIn")) {
            track.removeFade(track.fadeIn);
            track.fadeIn = undefined;
          }
          if (!whichFades.includes("FadeOut")) {
            track.removeFade(track.fadeOut);
            track.fadeOut = undefined;
          }
        }
      } else {
        track.removeFade(track.fadeIn);
        track.fadeIn = undefined;
        track.removeFade(track.fadeOut);
        track.fadeOut = undefined;
      }
      this.drawRequest();
    });

    ee.on("setNumberLanes", (numberLanes) => {
      this.setNumberLanes(numberLanes);
    });

    ee.on("handleTrackLaneChange", (obj) => {
      const track = this.getTrackByCustomID(obj.trackId);
      const oldLane = this.getLaneByID(track.lane);
      const newLane = this.getLaneByID(obj.laneId);
      track.setLane(newLane.id);
      oldLane.removeTrack(track);
      newLane.addTrack(track);
      this.adjustDuration();
      this.drawRequest();
    });
  }

  load(trackList, event = "none") {
    const loadPromises = trackList.map((trackInfo) => {
      const loader = LoaderFactory.createLoader(
        trackInfo.src,
        this.ac,
        this.ee
      );
      return loader.load().then((audioBuffer) => {
        if (audioBuffer.sampleRate === this.sampleRate) {
          return audioBuffer;
        } else {
          return resampleAudioBuffer(audioBuffer, this.sampleRate);
        }
      });
    });

    return Promise.all(loadPromises)
      .then((audioBuffers) => {
        this.ee.emit("audiosourcesloaded");

        const tracks = audioBuffers.map((audioBuffer, index) => {
          const info = trackList[index];
          const name = info.name || "Untitled";
          const start = info.start || 0;
          const states = info.states || {};
          const fadeIn = info.fadeIn;
          const fadeOut = info.fadeOut;
          const cueIn = info.cuein || 0;
          const cueOut = info.cueout || audioBuffer.duration;
          const gain = info.gain || 1;
          const muted = info.muted || false;
          const soloed = info.soloed || false;
          const selection = info.selected;
          const lane = info.lane;
          const customID = info.customID || undefined;
          const peaks = info.peaks || { type: "WebAudio", mono: this.mono };
          const customClass = info.customClass || undefined;
          const waveOutlineColor = info.waveOutlineColor || undefined;
          const stereoPan = info.stereoPan || 0;
          const effects = info.effects || null;

          // webaudio specific playout for now.
          const playout = new Playout(
            this.ac,
            audioBuffer,
            this.masterGainNode
          );

          const track = new Track();
          track.src =
            info.src instanceof Blob ? URL.createObjectURL(info.src) : info.src;
          track.setBuffer(audioBuffer);
          track.setLane(lane);
          track.setCustomID(customID);
          track.setName(name);
          track.setEventEmitter(this.ee);
          track.setEnabledStates(states);
          track.setCues(cueIn, cueOut);
          track.setCustomClass(customClass);
          track.setWaveOutlineColor(waveOutlineColor);

          if (fadeIn !== undefined) {
            track.setFadeIn(fadeIn.duration, fadeIn.shape);
          }

          if (fadeOut !== undefined) {
            track.setFadeOut(fadeOut.duration, fadeOut.shape);
          }

          if (selection !== undefined) {
            this.setActiveTrack(track);
            this.setTimeSelection(selection.start, selection.end);
          }

          if (peaks !== undefined) {
            track.setPeakData(peaks);
          }

          track.setState(this.getState());
          track.setStartTime(start);
          track.setPlayout(playout);

          track.setGainLevel(gain);
          track.setStereoPanValue(stereoPan);
          if (effects) {
            track.setEffects(effects);
          }

          if (muted) {
            this.muteTrack(track);
          }

          if (soloed) {
            this.soloTrack(track);
          }

          // extract peaks with AudioContext for now.
          track.calculatePeaks(this.samplesPerPixel, this.sampleRate);
          if (event === "redo") {
            this.ee.emit("createRedoStep", track);
          }
          return track;
        });

        this.tracks = this.tracks.concat(tracks);

        this.tracks.forEach((track) => {
          const found = this.lanes.some((lane) => lane.id === track.lane);
          if (!found) {
            const lane = new Lane();
            lane.setName(`Track-${track.lane}`);
            lane.setId(track.lane);
            lane.setEventEmitter(this.ee);
            lane.setDuration(track.duration);
            lane.setEndTime(track.endTime);
            lane.addTrack(track);
            this.lanes.push(lane);
          }
        });
        this.adjustDuration();
        this.draw(this.render());

        this.ee.emit("audiosourcesrendered");
      })
      .catch((e) => {
        this.ee.emit("audiosourceserror", e);
      });
  }

  createTrackFromSplit({ trackToSplit, name, splitTime }) {
    const enabledStates = trackToSplit.enabledStates;
    const buffer = trackToSplit.buffer;
    const fadeOut = trackToSplit.fadeOut;
    const cueIn = trackToSplit.cueIn;
    const cueOut = trackToSplit.cueOut;
    const gain = trackToSplit.gain || 1;

    let muted = false;
    if (this.mutedTracks.indexOf(trackToSplit) !== -1) {
      muted = true;
    }

    let soloed = false;
    if (this.soloedTracks.indexOf(trackToSplit) !== -1) {
      soloed = true;
    }

    const peaks = trackToSplit.peakData;
    const customClass = trackToSplit.customClass;
    const waveOutlineColor = trackToSplit.waveOutlineColor;
    const stereoPan = trackToSplit.stereoPan || 0;
    const effects = trackToSplit.effectsGraph || null;

    // webaudio specific playout for now.
    const playout = new Playout(this.ac, buffer, this.masterGainNode);

    const track = new Track();
    track.src = trackToSplit.src;
    track.setBuffer(buffer);
    track.setName(name);
    track.setEventEmitter(this.ee);
    track.setEnabledStates(enabledStates);
    track.setCues(cueIn, cueOut);
    track.setCustomClass(customClass);
    track.setWaveOutlineColor(waveOutlineColor);

    if (fadeOut !== undefined) {
      const fade = trackToSplit.fades[fadeOut];
      track.setFadeOut(fade.end - fade.start, fade.shape);
    }

    if (peaks !== undefined) {
      track.setPeakData(peaks);
    }

    track.setState(this.getState());
    track.setPlayout(playout);

    track.setGainLevel(gain);
    track.setStereoPanValue(stereoPan);
    if (effects) {
      track.setEffects(effects);
    }

    if (muted) {
      this.muteTrack(track);
    }

    if (soloed) {
      this.soloTrack(track);
    }

    track.setStartTime(trackToSplit.startTime);
    track.trim(splitTime, track.endTime);

    // extract peaks with AudioContext for now.
    track.calculatePeaks(this.samplesPerPixel, this.sampleRate);

    this.tracks = this.tracks.concat([track]);
    this.adjustDuration();
    this.draw(this.render());
    this.setActiveTrack(track);

    this.ee.emit("audiosourcesrendered");
  }

  getLaneByID(id) {
    let laneInfo = undefined;
    this.lanes.forEach((lane) => {
      if (lane.id === id) {
        laneInfo = lane;
      }
    });
    return laneInfo;
  }

  getTrackByCustomID(customID) {
    let trackInfo = undefined;
    this.tracks.forEach((track) => {
      if (track.customID === customID) {
        trackInfo = track;
      }
    });
    return trackInfo;
  }
  /*
    track instance of Track.
  */
  setActiveTrack(track) {
    this.activeTrack = track;
  }

  getActiveTrack() {
    return this.activeTrack;
  }

  isSegmentSelection() {
    return this.timeSelection.start !== this.timeSelection.end;
  }

  /*
    start, end in seconds.
  */
  setTimeSelection(start = 0, end) {
    this.timeSelection = {
      start,
      end: end === undefined ? start : end,
    };

    this.cursor = start;
  }

  async startOfflineRender(type) {
    if (this.isRendering) {
      return;
    }

    this.isRendering = true;
    this.offlineAudioContext = new OfflineAudioContext(
      2,
      44100 * this.duration,
      44100
    );

    const setUpChain = [];

    this.ee.emit(
      "audiorenderingstarting",
      this.offlineAudioContext,
      setUpChain
    );

    const currentTime = this.offlineAudioContext.currentTime;
    const mg = this.offlineAudioContext.createGain();

    this.tracks.forEach((track) => {
      const playout = new Playout(this.offlineAudioContext, track.buffer, mg);
      playout.setEffects(track.effectsGraph);
      playout.setMasterEffects(this.effectsGraph);
      track.setOfflinePlayout(playout);

      track.schedulePlay(currentTime, 0, 0, {
        shouldPlay: this.shouldTrackPlay(track),
        masterGain: 1,
        isOffline: true,
      });
    });

    /*
      TODO cleanup of different audio playouts handling.
    */
    await Promise.all(setUpChain);
    const audioBuffer = await this.offlineAudioContext.startRendering();

    if (type === "buffer") {
      this.ee.emit("audiorenderingfinished", type, audioBuffer);
      this.isRendering = false;
    } else if (type === "wav" || type === "wavRaw") {
      this.exportWorker.postMessage({
        command: "init",
        config: {
          sampleRate: 44100,
        },
      });

      // callback for `exportWAV`
      this.exportWorker.onmessage = (e) => {
        this.ee.emit("audiorenderingfinished", type, e.data);
        this.isRendering = false;

        // clear out the buffer for next renderings.
        this.exportWorker.postMessage({
          command: "clear",
        });
      };

      // send the channel data from our buffer to the worker
      this.exportWorker.postMessage({
        command: "record",
        buffer: [audioBuffer.getChannelData(0), audioBuffer.getChannelData(1)],
      });

      // ask the worker for a WAV
      this.exportWorker.postMessage({
        command: "exportWAV",
        type: "audio/wav",
        raw: type === "wavRaw",
      });
    }
  }

  getTimeSelection() {
    return this.timeSelection;
  }

  setState(state) {
    this.state = state;

    this.tracks.forEach((track) => {
      track.setState(state);
    });
  }

  getState() {
    return this.state;
  }

  setZoomIndex(index) {
    this.zoomIndex = index;
  }

  setZoomLevels(levels) {
    this.zoomLevels = levels;
  }

  setZoom(zoom) {
    this.samplesPerPixel = zoom;
    this.zoomIndex = this.zoomLevels.indexOf(zoom);
    this.tracks.forEach((track) => {
      track.calculatePeaks(zoom, this.sampleRate);
    });
  }

  muteTrack(track) {
    const index = this.mutedTracks.indexOf(track);

    if (index > -1) {
      this.mutedTracks.splice(index, 1);
    } else {
      this.mutedTracks.push(track);
    }
  }

  soloTrack(track) {
    const index = this.soloedTracks.indexOf(track);

    if (index > -1) {
      this.soloedTracks.splice(index, 1);
    } else if (this.exclSolo) {
      this.soloedTracks = [track];
    } else {
      this.soloedTracks.push(track);
    }
  }

  collapseTrack(track, opts) {
    if (opts.collapsed) {
      this.collapsedTracks.push(track);
    } else {
      const index = this.collapsedTracks.indexOf(track);

      if (index > -1) {
        this.collapsedTracks.splice(index, 1);
      }
    }
  }

  removeTrack(track) {
    if (track.isPlaying()) {
      track.scheduleStop();
    }

    const trackLists = [
      this.mutedTracks,
      this.soloedTracks,
      this.collapsedTracks,
      this.tracks,
    ];
    trackLists.forEach((list) => {
      const index = list.indexOf(track);
      if (index > -1) {
        list.splice(index, 1);
      }
    });
  }

  renameTrack({ track, event }) {
    if (event.key === "Enter") {
      if (event.target.innerText) track.name = event.target.innerText;
      else event.target.innerText = track.name;
      event.target.blur();
      track.setName(event.target.innerText);
    }
  }

  renameLane({ lane, event }) {
    if (event.key === "Enter") {
      if (event.target.innerText) lane.name = event.target.innerText;
      else event.target.innerText = lane.name;
      event.target.blur();
      lane.setName(event.target.innerText);
    }
  }

  adjustTrackPlayout() {
    this.tracks.forEach((track) => {
      track.setShouldPlay(this.shouldTrackPlay(track));
    });
  }

  adjustDuration() {
    this.duration = this.tracks.reduce(
      (duration, track) => Math.max(duration, track.getEndTime()),
      0
    );
  }

  shouldTrackPlay(track) {
    let shouldPlay;
    // if there are solo tracks, only they should play.
    if (this.soloedTracks.length > 0) {
      shouldPlay = false;
      if (this.soloedTracks.indexOf(track) > -1) {
        shouldPlay = true;
      }
    } else {
      // play all tracks except any muted tracks.
      shouldPlay = true;
      if (this.mutedTracks.indexOf(track) > -1) {
        shouldPlay = false;
      }
    }

    return shouldPlay;
  }

  isPlaying() {
    return this.tracks.reduce(
      (isPlaying, track) => isPlaying || track.isPlaying(),
      false
    );
  }

  /*
   *   returns the current point of time in the playlist in seconds.
   */
  getCurrentTime() {
    const cursorPos = this.lastSeeked || this.pausedAt || this.cursor;

    return cursorPos + this.getElapsedTime();
  }

  getElapsedTime() {
    return this.ac.currentTime - this.lastPlay;
  }

  setMasterGain(gain) {
    this.ee.emit("mastervolumechange", gain);
  }

  restartPlayFrom(start, end) {
    this.stopAnimation();

    this.tracks.forEach((editor) => {
      editor.scheduleStop();
    });

    return Promise.all(this.playoutPromises).then(
      this.play.bind(this, start, end)
    );
  }

  play(startTime, endTime) {
    clearTimeout(this.resetDrawTimer);

    const currentTime = this.ac.currentTime;
    const selected = this.getTimeSelection();
    const playoutPromises = [];

    const start = startTime || this.pausedAt || this.cursor;
    let end = endTime;

    if (!end && selected.end !== selected.start && selected.end > start) {
      end = selected.end;
    }

    if (this.isPlaying()) {
      return this.restartPlayFrom(start, end);
    }

    // TODO refector this in upcoming modernisation.
    if (this.effectsGraph)
      this.tracks && this.tracks[0].playout.setMasterEffects(this.effectsGraph);

    this.tracks.forEach((track) => {
      playoutPromises.push(
        track.schedulePlay(currentTime, start, end, {
          shouldPlay: this.shouldTrackPlay(track),
          masterGain: this.masterGain,
        })
      );
    });

    this.lastPlay = currentTime;
    // use these to track when the playlist has fully stopped.
    this.playoutPromises = playoutPromises;
    this.startAnimation(start);

    return Promise.all(this.playoutPromises);
  }

  pause() {
    if (!this.isPlaying()) {
      return Promise.all(this.playoutPromises);
    }

    this.pausedAt = this.getCurrentTime();
    return this.playbackReset();
  }

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.stop();
    }

    this.pausedAt = undefined;
    this.playbackSeconds = 0;
    return this.playbackReset();
  }

  playbackReset() {
    this.lastSeeked = undefined;
    this.stopAnimation();

    this.tracks.forEach((track) => {
      track.scheduleStop();
      track.setState(this.getState());
    });

    // TODO improve this.
    this.masterGainNode.disconnect();
    this.drawRequest();
    return Promise.all(this.playoutPromises);
  }

  rewind() {
    return this.stop().then(() => {
      this.scrollLeft = 0;
      this.ee.emit("select", 0, 0);
    });
  }

  fastForward() {
    return this.stop().then(() => {
      if (this.viewDuration < this.duration) {
        this.scrollLeft = this.duration - this.viewDuration;
      } else {
        this.scrollLeft = 0;
      }

      this.ee.emit("select", this.duration, this.duration);
    });
  }

  clear() {
    return this.stop().then(() => {
      this.tracks = [];
      this.laneElements = [];
      this.soloedTracks = [];
      this.mutedTracks = [];
      this.playoutPromises = [];
      this.cursor = 0;
      this.playbackSeconds = 0;
      this.duration = 0;
      this.scrollLeft = 0;
      this.lanes = [];
      this.seek(0, 0, undefined);
    });
  }

  record() {
    const playoutPromises = [];
    this.mediaRecorder.start(300);

    this.tracks.forEach((track) => {
      track.setState("none");
      playoutPromises.push(
        track.schedulePlay(this.ac.currentTime, 0, undefined, {
          shouldPlay: this.shouldTrackPlay(track),
        })
      );
    });

    this.playoutPromises = playoutPromises;
  }

  setNumberLanes(numberLanes) {
    const found = this.lanes.some((lane) => lane.id === numberLanes);
    if (!found) {
      const lane = new Lane();
      lane.setName(`Track-${numberLanes}`);
      lane.setId(numberLanes);
      lane.setEventEmitter(this.ee);
      this.lanes.push(lane);
      this.adjustDuration();
      this.drawRequest();
    }
  }

  startAnimation(startTime) {
    this.lastDraw = this.ac.currentTime;
    this.animationRequest = window.requestAnimationFrame(() => {
      this.updateEditor(startTime);
    });
  }

  stopAnimation() {
    window.cancelAnimationFrame(this.animationRequest);
    this.lastDraw = undefined;
  }

  seek(start, end, track) {
    if (this.isPlaying()) {
      this.lastSeeked = start;
      this.pausedAt = undefined;
      this.restartPlayFrom(start);
    } else {
      // reset if it was paused.
      this.setActiveTrack(track || this.tracks[0]);
      this.pausedAt = start;
      this.setTimeSelection(start, end);
      if (this.getSeekStyle() === "fill") {
        this.playbackSeconds = start;
      }
    }
  }

  /*
   * Animation function for the playlist.
   * Keep under 16.7 milliseconds based on a typical screen refresh rate of 60fps.
   */
  updateEditor(cursor) {
    const currentTime = this.ac.currentTime;
    const selection = this.getTimeSelection();
    const cursorPos = cursor || this.cursor;
    const elapsed = currentTime - this.lastDraw;

    if (this.isPlaying()) {
      const playbackSeconds = cursorPos + elapsed;
      this.ee.emit("timeupdate", playbackSeconds);
      this.animationRequest = window.requestAnimationFrame(() => {
        this.updateEditor(playbackSeconds);
      });

      this.playbackSeconds = playbackSeconds;
      this.draw(this.render());
      this.lastDraw = currentTime;
      this.ee.emit("audiosourcesrendered");
    } else {
      if (
        cursorPos + elapsed >=
        (this.isSegmentSelection() ? selection.end : this.duration)
      ) {
        this.ee.emit("finished");
      }

      this.stopAnimation();

      this.resetDrawTimer = setTimeout(() => {
        this.pausedAt = undefined;
        this.lastSeeked = undefined;
        this.setState(this.getState());

        this.playbackSeconds = 0;
        this.draw(this.render());
        this.ee.emit("audiosourcesrendered");
      }, 0);
    }
  }

  drawRequest() {
    window.requestAnimationFrame(() => {
      this.draw(this.render());
      this.ee.emit("audiosourcesrendered");
    });
    this.getTrackByCustomID();
  }

  draw(newTree) {
    const patches = diff(this.tree, newTree);
    this.rootNode = patch(this.rootNode, patches);
    this.tree = newTree;

    // use for fast forwarding.
    this.viewDuration = pixelsToSeconds(
      this.rootNode.clientWidth - this.controls.width,
      this.samplesPerPixel,
      this.sampleRate
    );
  }

  getTrackRenderData(data = {}) {
    const defaults = {
      height: this.waveHeight,
      resolution: this.samplesPerPixel,
      sampleRate: this.sampleRate,
      controls: this.controls,
      isActive: false,
      timeSelection: this.getTimeSelection(),
      playlistLength: this.duration,
      playbackSeconds: this.playbackSeconds,
      colors: this.colors,
      barWidth: this.barWidth,
      barGap: this.barGap,
    };

    return _defaults({}, data, defaults);
  }

  isActiveTrack(track) {
    const activeTrack = this.getActiveTrack();

    if (this.isSegmentSelection()) {
      return activeTrack === track;
    }

    return true;
  }

  renderAnnotations() {
    return this.annotationList.render();
  }

  renderTimeScale() {
    const controlWidth = this.controls.show ? this.controls.width : 0;
    const timeScale = new TimeScale(
      this.duration,
      this.scrollLeft,
      this.samplesPerPixel,
      this.sampleRate,
      controlWidth,
      this.colors
    );

    return timeScale.render();
  }

  renderLanes(lanes) {
    const lanesObject = [];
    lanes.forEach((lane) => {
      lanesObject.push(this.renderLane(lane));
    });
    return h(`div.lanes`, {}, lanesObject);
  }

  renderLane(lane) {
    const laneChildren = this.tracks
      .sort((a, b) =>
        a.customID > b.customID ? 1 : b.customID > a.customID ? -1 : 0
      )
      .map((track) => {
        if (track.lane === lane.id) {
          const collapsed = this.collapsedTracks.indexOf(track) > -1;
          return track.render(
            this.getTrackRenderData({
              isActive: this.isActiveTrack(track),
              shouldPlay: this.shouldTrackPlay(track),
              soloed: this.soloedTracks.indexOf(track) > -1,
              muted: this.mutedTracks.indexOf(track) > -1,
              collapsed,
              height: collapsed ? this.collapsedWaveHeight : this.waveHeight,
              barGap: this.barGap,
              barWidth: this.barWidth,
            })
          );
        }
      });
    const laneOverlay = h(`div.lane-overlay`, {
      attributes: {
        style: `height: 100%; width: 100%; position: absolute; top: 0; left: 0; pointer-events: 0;`,
        laneId: lane.id,
      },
    });
    laneChildren.push(laneOverlay);
    return h(`div.lane.lane-${lane.id}`, {}, laneChildren);
  }

  removeLane(lane) {
    if (lane.tracks.length > 0) {
      lane.tracks.forEach((track) => {
        this.removeTrack(track);
      });
    }
    const index = this.lanes.indexOf(lane);
    if (index > -1) {
      this.lanes.splice(index, 1);
    }
    if (this.lanes.length === 0) {
      this.tracks.forEach((track) => {
        this.removeTrack(track);
      });
    }
    this.adjustDuration();
    this.adjustTrackPlayout();
    this.drawRequest();
  }

  renderTrackSection() {
    const lanesElement = this.renderLanes(this.lanes);

    return h(
      "div.playlist-tracks",
      {
        onscroll: (e) => {
          this.scrollLeft = pixelsToSeconds(
            e.target.scrollLeft,
            this.samplesPerPixel,
            this.sampleRate
          );

          this.ee.emit("scroll");
        },
        hook: new ScrollHook(this),
      },
      lanesElement
    );
  }

  renderLaneControls(lane) {
    const muteClass = lane.muted ? ".active" : "";
    const soloClass = lane.soloed ? ".active" : "";

    const trackName = h(
      "div.single-line",
      {
        attributes: {
          contentEditable: true,
        },
        onkeypress: (e) => {
          this.renameLane({ lane: lane, event: e });
        },
      },
      [lane.name]
    );
    const removeTrack = h(
      "button.btn.btn-danger.btn-xs.track-remove",
      {
        attributes: {
          type: "button",
          title: "Remove track",
        },
        onclick: () => {
          this.removeLane(lane);
        },
      },
      [h("i.fas.fa-times")]
    );
    const headerChildren = [];
    headerChildren.push(removeTrack);
    headerChildren.push(trackName);
    const controls = [h("div.track-header", headerChildren)];

    controls.push(
      h("div.btn-group", [
        h(
          `button.btn.btn-outline-dark.btn-xs.btn-mute${muteClass}`,
          {
            attributes: {
              type: "button",
            },
            onclick: () => {
              lane.muted ? lane.setMuted(false) : lane.setMuted(true);
              this.drawRequest();
            },
          },
          ["Mute"]
        ),
        h(
          `button.btn.btn-outline-dark.btn-xs.btn-solo${soloClass}`,
          {
            onclick: (evt) => {},
          },
          ["Solo"]
        ),
      ])
    );
    controls.push(
      h("label.volume", [
        h("input.volume-slider", {
          attributes: {
            "aria-label": "Track volume control",
            type: "range",
            min: 0,
            max: 100,
            value: 100,
          },
          hook: new VolumeSliderHook(lane.gain),
          oninput: (e) => {
            lane.setGainLevel(e.target.value / 100);
            this.drawRequest();
          },
        }),
      ])
    );
    return h(
      "div.controls",
      {
        attributes: {
          style: `height: ${125}px; width: ${125}px;z-index: 10;`,
        },
      },
      controls
    );
  }

  renderFixed() {
    const fixedChildren = [];

    this.lanes.forEach((lane) => {
      fixedChildren.push(this.renderLaneControls(lane));
    });

    return h(
      "div.playlist-fixed",
      {
        attributes: {
          style: "overflow: hidden; position: relative;",
        },
      },
      fixedChildren
    );
  }

  renderScrollable() {
    const scrollableChildren = [];
    const playbackX = secondsToPixels(
      this.playbackSeconds,
      this.samplesPerPixel,
      this.sampleRate
    );

    const cursor = h("div.playback-indicator", {
      attributes: {
        style: `position: absolute; width: 2px; height: calc(100% - 27px); margin: 0; padding: 0; top: 27px; left: calc(20px + ${playbackX}px); bottom: 0; z-index: 14; background: #f2765d; cursor: grab;`,
      },
    });

    if (this.showTimescale) {
      scrollableChildren.push(this.renderTimeScale());
    }
    scrollableChildren.push(cursor);

    scrollableChildren.push(this.renderTrackSection());

    if (this.annotationList.length) {
      scrollableChildren.push(this.renderAnnotations());
    }
    return h(
      "div.playlist-scrollable",
      {
        attributes: {
          style: "position: relative;",
        },
      },
      scrollableChildren
    );
  }

  render() {
    const containerChildren = [];

    containerChildren.push(this.renderFixed());
    containerChildren.push(this.renderScrollable());

    return h(
      "div.playlist",
      {
        attributes: {
          style: "overflow: hidden; position: relative;",
        },
      },
      containerChildren
    );
  }

  getInfo() {
    const tracks = [];

    this.tracks.forEach((track) => {
      tracks.push(track.getTrackDetails());
    });

    return {
      tracks,
      lanes: this.lanes,
      effects: this.effectsGraph,
    };
  }
}
