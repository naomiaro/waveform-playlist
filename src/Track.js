import _assign from "lodash.assign";
import _forOwn from "lodash.forown";

import { v4 as uuidv4 } from "uuid";
import h from "virtual-dom/h";

import extractPeaks from "webaudio-peaks";
import { FADEIN, FADEOUT } from "fade-maker";

import { secondsToPixels, secondsToSamples } from "./utils/conversions";
import stateClasses from "./track/states";

import CanvasHook from "./render/CanvasHook";
import FadeCanvasHook from "./render/FadeCanvasHook";
import VolumeSliderHook from "./render/VolumeSliderHook";
import StereoPanSliderHook from "./render/StereoPanSliderHook";
import Playout from "./Playout";

const MAX_CANVAS_WIDTH = 1000;

export default class {
  constructor() {
    this.name = "Untitled";
    this.customID = "";
    this.lane = 0;
    this.customClass = undefined;
    this.waveOutlineColor = undefined;
    this.gain = 1;
    this.fades = {};
    this.peakData = {
      type: "WebAudio",
      mono: false,
    };

    this.cueIn = 0;
    this.cueOut = 0;
    this.duration = 0;
    this.startTime = 0;
    this.endTime = 0;
    this.stereoPan = 0;
  }

  setEventEmitter(ee) {
    this.ee = ee;
  }
  setLane(lane) {
    this.lane = lane;
  }
  setCustomID(customID) {
    this.customID = customID;
  }
  setName(name) {
    this.name = name;
  }

  setCustomClass(className) {
    this.customClass = className;
  }

  setWaveOutlineColor(color) {
    this.waveOutlineColor = color;
  }

  setCues(cueIn, cueOut) {
    if (cueOut < cueIn) {
      throw new Error("cue out cannot be less than cue in");
    }

    this.cueIn = cueIn;
    this.cueOut = cueOut;
    this.duration = this.cueOut - this.cueIn;
    this.endTime = this.startTime + this.duration;
  }

  /*
   *   start, end in seconds relative to the entire playlist.
   */
  trim(start, end) {
    const trackStart = this.getStartTime();
    const trackEnd = this.getEndTime();
    const offset = this.cueIn - trackStart;

    if (
      (trackStart <= start && trackEnd >= start) ||
      (trackStart <= end && trackEnd >= end)
    ) {
      const cueIn = start < trackStart ? trackStart : start;
      const cueOut = end > trackEnd ? trackEnd : end;

      this.setCues(cueIn + offset, cueOut + offset);
      if (start > trackStart) {
        this.setStartTime(start);
      }
    }
  }

  removePart(point1, point2, audioContext, track) {
    this.ee.emit("saveCutManipulation", this.buffer, track);

    const trackStart = this.getStartTime();
    const trackEnd = this.getEndTime();

    let start;
    let end;
    if (point1 <= point2) {
      start = point1;
      end = point2;
    } else {
      start = point2;
      end = point1;
    }

    let timeSplitOffset = start - this.getStartTime();
    if (timeSplitOffset < 0) {
      // outside interval left
      timeSplitOffset = 0;
    }
    const firstPartPercentage = timeSplitOffset / this.duration;

    const secondTimeSplitOffset = end - this.getStartTime();
    let secondPartPercentage =
      (this.duration - secondTimeSplitOffset) / this.duration;
    if (secondPartPercentage < 0) {
      // outside interval right
      secondPartPercentage = 0;
    }

    if (start <= trackEnd && end >= trackStart) {
      const channels = this.buffer.numberOfChannels;

      let newArrayBuffer;
      const firstPartNewLength = firstPartPercentage * this.buffer.length;
      const secondPartNewLength = secondPartPercentage * this.buffer.length;
      try {
        newArrayBuffer = audioContext.createBuffer(
          channels,
          firstPartNewLength + secondPartNewLength,
          this.buffer.sampleRate
        );
        const arrayFirstPart = new Float32Array(firstPartNewLength);
        const arraySecondPart = new Float32Array(secondPartNewLength);

        for (let channel = 0; channel < channels; channel++) {
          this.buffer.copyFromChannel(arrayFirstPart, channel, 0);
          this.buffer.copyFromChannel(
            arraySecondPart,
            channel,
            this.buffer.length - secondPartNewLength
          );
          newArrayBuffer.copyToChannel(arrayFirstPart, channel, 0);
          newArrayBuffer.copyToChannel(
            arraySecondPart,
            channel,
            firstPartNewLength
          );
        }
      } catch (e) {
        // handle error here
        throw e;
      }
      let fades = track.fades;
      if (typeof fades !== "undefined" && Object.keys(fades).length > 0) {
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
        if (totalFadesDuration >= newArrayBuffer.duration) {
          // Only remove fades if they will intersect or be longer than new arrayBuffer after cut
          if (this.fadeIn) {
            this.removeFade(this.fadeIn);
            this.fadeIn = undefined;
          }
          if (this.fadeOut) {
            this.removeFade(this.fadeOut);
            this.fadeOut = undefined;
          }
        }
      }

      this.buffer = newArrayBuffer;
      this.setCues(0, newArrayBuffer.duration);
      this.playout.buffer = this.buffer;
    }
  }

  changeBuffer(AudioBuffer) {
    this.buffer = AudioBuffer;
    this.setCues(0, AudioBuffer.duration);
    this.playout.buffer = this.buffer;
  }

  setStartTime(start) {
    this.startTime = start;
    this.endTime = start + this.duration;
  }

  setPlayout(playout) {
    this.playout = playout;
  }

  setOfflinePlayout(playout) {
    this.offlinePlayout = playout;
  }

  setEnabledStates(enabledStates = {}) {
    const defaultStatesEnabled = {
      cursor: true,
      fadein: true,
      fadeout: true,
      select: true,
      shift: true,
    };

    this.enabledStates = _assign({}, defaultStatesEnabled, enabledStates);
  }

  setFadeIn(duration, shape = "logarithmic") {
    if (duration > this.duration) {
      throw new Error("Invalid Fade In");
    }
    if (this.fadeOut) {
      const fadeOut = this.fades[this.fadeOut];
      let fadeOutDuration = fadeOut.end - fadeOut.start;
      let totalDuration = fadeOutDuration + duration;
      if (totalDuration > this.duration) {
        // fades will intersect
        duration = this.duration - fadeOutDuration - 0.1; // give fade the available duration (with 0.1s margin) instead
      }
    }
    const fade = {
      shape,
      start: 0,
      end: duration,
    };

    if (this.fadeIn) {
      this.removeFade(this.fadeIn);
      this.fadeIn = undefined;
    }
    this.fadeIn = this.saveFade(FADEIN, fade.shape, fade.start, fade.end);
  }

  setFadeOut(duration, shape = "logarithmic") {
    if (duration > this.duration) {
      throw new Error("Invalid Fade Out");
    }

    if (this.fadeIn) {
      const fadeIn = this.fades[this.fadeIn];
      let fadeInDuration = fadeIn.end - fadeIn.start;
      let totalDuration = fadeInDuration + duration;
      if (totalDuration > this.duration) {
        // fades will intersect
        duration = this.duration - fadeInDuration - 0.1; // give fade the available duration (with 0.1s margin) instead
      }
    }

    const fade = {
      shape,
      start: this.duration - duration,
      end: this.duration,
    };

    if (this.fadeOut) {
      this.removeFade(this.fadeOut);
      this.fadeOut = undefined;
    }

    this.fadeOut = this.saveFade(FADEOUT, fade.shape, fade.start, fade.end);
  }

  saveFade(type, shape, start, end) {
    const id = uuidv4();

    this.fades[id] = {
      type,
      shape,
      start,
      end,
    };

    return id;
  }

  removeFade(id) {
    delete this.fades[id];
  }

  setBuffer(buffer) {
    this.buffer = buffer;
  }

  setPeakData(data) {
    this.peakData = data;
  }

  calculatePeaks(samplesPerPixel, sampleRate) {
    const cueIn = secondsToSamples(this.cueIn, sampleRate);
    const cueOut = secondsToSamples(this.cueOut, sampleRate);

    this.setPeaks(
      extractPeaks(
        this.buffer,
        samplesPerPixel,
        this.peakData.mono,
        cueIn,
        cueOut
      )
    );
  }

  setPeaks(peaks) {
    this.peaks = peaks;
  }

  setState(state) {
    this.state = state;

    if (this.state && this.enabledStates[this.state]) {
      const StateClass = stateClasses[this.state];
      this.stateObj = new StateClass(this);
    } else {
      this.stateObj = undefined;
    }
  }

  getStartTime() {
    return this.startTime;
  }

  getEndTime() {
    return this.endTime;
  }

  getDuration() {
    return this.duration;
  }

  isPlaying() {
    return this.playout.isPlaying();
  }

  setShouldPlay(bool) {
    this.playout.setShouldPlay(bool);
  }

  setGainLevel(level) {
    this.gain = level;
    this.playout.setVolumeGainLevel(level);
  }

  setMasterGainLevel(level) {
    this.playout.setMasterGainLevel(level);
  }

  setStereoPanValue(value) {
    this.stereoPan = value;
    this.playout.setStereoPanValue(value);
  }

  setEffects(effectsGraph) {
    this.effectsGraph = effectsGraph;
    this.playout.setEffects(effectsGraph);
  }

  /*
    startTime, endTime in seconds (float).
    segment is for a highlighted section in the UI.

    returns a Promise that will resolve when the AudioBufferSource
    is either stopped or plays out naturally.
  */
  schedulePlay(now, startTime, endTime, config) {
    let start;
    let duration;
    let when = now;
    let segment = endTime ? endTime - startTime : undefined;

    const defaultOptions = {
      shouldPlay: true,
      masterGain: 1,
      isOffline: false,
    };

    const options = _assign({}, defaultOptions, config);
    const playoutSystem = options.isOffline
      ? this.offlinePlayout
      : this.playout;

    // 1) track has no content to play.
    // 2) track does not play in this selection.
    if (
      this.endTime <= startTime ||
      (segment && startTime + segment < this.startTime)
    ) {
      // return a resolved promise since this track is technically "stopped".
      return Promise.resolve();
    }

    // track should have something to play if it gets here.

    // the track starts in the future or on the cursor position
    if (this.startTime >= startTime) {
      start = 0;
      // schedule additional delay for this audio node.
      when += this.startTime - startTime;

      if (endTime) {
        segment -= this.startTime - startTime;
        duration = Math.min(segment, this.duration);
      } else {
        duration = this.duration;
      }
    } else {
      start = startTime - this.startTime;

      if (endTime) {
        duration = Math.min(segment, this.duration - start);
      } else {
        duration = this.duration - start;
      }
    }

    start += this.cueIn;
    const relPos = startTime - this.startTime;
    const sourcePromise = playoutSystem.setUpSource();

    // param relPos: cursor position in seconds relative to this track.
    // can be negative if the cursor is placed before the start of this track etc.
    _forOwn(this.fades, (fade) => {
      let fadeStart;
      let fadeDuration;

      // only apply fade if it's ahead of the cursor.
      if (relPos < fade.end) {
        if (relPos <= fade.start) {
          fadeStart = now + (fade.start - relPos);
          fadeDuration = fade.end - fade.start;
        } else if (relPos > fade.start && relPos < fade.end) {
          fadeStart = now - (relPos - fade.start);
          fadeDuration = fade.end - fade.start;
        }

        switch (fade.type) {
          case FADEIN: {
            playoutSystem.applyFadeIn(fadeStart, fadeDuration, fade.shape);
            break;
          }
          case FADEOUT: {
            playoutSystem.applyFadeOut(fadeStart, fadeDuration, fade.shape);
            break;
          }
          default: {
            throw new Error("Invalid fade type saved on track.");
          }
        }
      }
    });

    playoutSystem.setVolumeGainLevel(this.gain);
    playoutSystem.setShouldPlay(options.shouldPlay);
    playoutSystem.setMasterGainLevel(options.masterGain);
    playoutSystem.setStereoPanValue(this.stereoPan);
    playoutSystem.play(when, start, duration);

    return sourcePromise;
  }

  scheduleStop(when = 0) {
    this.playout.stop(when);
  }

  renderOverlay(data) {
    const channelPixels = secondsToPixels(
      data.playlistLength,
      data.resolution,
      data.sampleRate
    );

    const config = {
      attributes: {
        style: `position: absolute; top: 0; right: 0; bottom: 0; left: 0; width: ${channelPixels}px; z-index: 9;`,
      },
    };

    let overlayClass = "";
    if (this.stateObj) {
      this.stateObj.setup(data.resolution, data.sampleRate);
      const StateClass = stateClasses[this.state];
      const events = StateClass.getEvents();

      events.forEach((event) => {
        config[`on${event}`] = this.stateObj[event].bind(this.stateObj);
      });

      overlayClass = StateClass.getClass();
    }

    // use this overlay for track event cursor position calculations.
    return h(`div.playlist-overlay${overlayClass}`, config);
  }

  renderControls(data) {
    const muteClass = data.muted ? ".active" : "";
    const soloClass = data.soloed ? ".active" : "";
    const isCollapsed = data.collapsed;
    const numChan = this.peaks.data.length;
    const widgets = data.controls.widgets;

    const removeTrack = h(
      "button.btn.btn-danger.btn-xs.track-remove",
      {
        attributes: {
          type: "button",
          title: "Remove track",
        },
        onclick: () => {
          this.ee.emit("createUndoStateAndRemoveTrack", this);
        },
      },
      [h("i.fas.fa-times")]
    );

    const trackName = h(
      "div.single-line",
      {
        attributes: {
          contentEditable: true,
        },
        onkeypress: (e) => {
          this.ee.emit("renameTrack", {
            track: this,
            event: e,
          });
        },
      },
      [this.name]
    );

    const collapseTrack = h(
      "button.btn.btn-info.btn-xs.track-collapse",
      {
        attributes: {
          type: "button",
          title: isCollapsed ? "Expand track" : "Collapse track",
        },
        onclick: () => {
          this.ee.emit("changeTrackView", this, {
            collapsed: !isCollapsed,
          });
        },
      },
      [h(`i.fas.${isCollapsed ? "fa-caret-down" : "fa-caret-up"}`)]
    );

    const headerChildren = [];

    if (widgets.remove) {
      headerChildren.push(removeTrack);
    }
    headerChildren.push(trackName);
    if (widgets.collapse) {
      headerChildren.push(collapseTrack);
    }

    const controls = [h("div.track-header", headerChildren)];

    if (!isCollapsed) {
      if (widgets.muteOrSolo) {
        controls.push(
          h("div.btn-group", [
            h(
              `button.btn.btn-outline-dark.btn-xs.btn-mute${muteClass}`,
              {
                attributes: {
                  type: "button",
                },
                onclick: () => {
                  this.ee.emit("mute", this);
                },
              },
              ["Mute"]
            ),
            h(
              `button.btn.btn-outline-dark.btn-xs.btn-solo${soloClass}`,
              {
                onclick: () => {
                  this.ee.emit("solo", this);
                },
              },
              ["Solo"]
            ),
          ])
        );
      }

      if (widgets.volume) {
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
              hook: new VolumeSliderHook(this.gain),
              oninput: (e) => {
                this.ee.emit("volumechange", e.target.value, this);
              },
            }),
          ])
        );
      }

      if (widgets.stereoPan) {
        controls.push(
          h("label.stereopan", [
            h("input.stereopan-slider", {
              attributes: {
                "aria-label": "Track stereo pan control",
                type: "range",
                min: -100,
                max: 100,
                value: 100,
              },
              hook: new StereoPanSliderHook(this.stereoPan),
              oninput: (e) => {
                this.ee.emit("stereopan", e.target.value / 100, this);
              },
            }),
          ])
        );
      }
    }

    return h(
      "div.controls",
      {
        attributes: {
          style: `height: ${numChan * data.height}px; width: ${
            data.controls.width
          }px; position: absolute; left: 0; z-index: 10;`,
        },
      },
      controls
    );
  }

  renderChannelWrapper(data) {
    const width = this.peaks.length;
    const playbackX = secondsToPixels(
      data.playbackSeconds,
      data.resolution,
      data.sampleRate
    );
    const startX = secondsToPixels(
      this.startTime,
      data.resolution,
      data.sampleRate
    );
    const endX = secondsToPixels(
      this.endTime,
      data.resolution,
      data.sampleRate
    );
    let progressWidth = 0;
    const numChan = this.peaks.data.length;
    const scale = Math.ceil(window.devicePixelRatio);

    if (playbackX > 0 && playbackX > startX) {
      if (playbackX < endX) {
        progressWidth = playbackX - startX;
      } else {
        progressWidth = width;
      }
    }

    const waveformChildren = [
      h("div.cursor", {
        attributes: {
          style: `position: absolute; width: 1px; margin: 0; padding: 0; top: 0; left: ${playbackX}px; bottom: 0; z-index: 5;`,
        },
      }),
    ];

    const channels = Object.keys(this.peaks.data).map((channelNum) => {
      const channelChildren = [
        h("div.channel-progress", {
          attributes: {
            style: `position: absolute; width: ${progressWidth}px; height: ${data.height}px; z-index: 2;`,
          },
        }),
      ];
      let offset = 0;
      let totalWidth = width;
      const peaks = this.peaks.data[channelNum];

      while (totalWidth > 0) {
        const currentWidth = Math.min(totalWidth, MAX_CANVAS_WIDTH);
        const canvasColor = this.waveOutlineColor
          ? this.waveOutlineColor
          : data.colors.waveOutlineColor;

        channelChildren.push(
          h("canvas", {
            attributes: {
              width: currentWidth * scale,
              height: data.height * scale,
              style: `float: left; position: relative; margin: 0; padding: 0; z-index: 3; width: ${currentWidth}px; height: ${data.height}px;`,
            },
            onmouseenter: (evt) => {
              const channelAfter = evt.target.offsetParent.nextElementSibling;
              const channelBefore =
                evt.target.offsetParent.previousElementSibling;
              const overlay = channelAfter.nextElementSibling;
              if (
                overlay.classList.contains("state-cursor") ||
                overlay.classList.contains("state-fadein") ||
                overlay.classList.contains("state-fadeout")
              ) {
                overlay.classList.add("hover");
                channelAfter.classList.remove("no-pointer-events");
                channelBefore.classList.remove("no-pointer-events");
              }
            },
            hook: new CanvasHook(
              peaks,
              offset,
              this.peaks.bits,
              canvasColor,
              scale,
              data.height,
              data.barWidth,
              data.barGap
            ),
          })
        );

        totalWidth -= currentWidth;
        offset += MAX_CANVAS_WIDTH;
      }
      // if there are fades, display them.
      if (this.fadeIn) {
        const fadeIn = this.fades[this.fadeIn];
        const fadeWidth = secondsToPixels(
          fadeIn.end - fadeIn.start,
          data.resolution,
          data.sampleRate
        );

        channelChildren.push(
          h(
            "div.wp-fade.wp-fadein",
            {
              attributes: {
                style: `position: absolute; height: ${data.height}px; width: ${fadeWidth}px; top: 0; left: 0; z-index: 4;`,
              },
            },
            [
              h("canvas", {
                attributes: {
                  width: fadeWidth,
                  height: data.height,
                },
                hook: new FadeCanvasHook(
                  fadeIn.type,
                  fadeIn.shape,
                  fadeIn.end - fadeIn.start,
                  data.resolution
                ),
              }),
            ]
          )
        );
      }

      if (this.fadeOut) {
        const fadeOut = this.fades[this.fadeOut];
        const fadeWidth = secondsToPixels(
          fadeOut.end - fadeOut.start,
          data.resolution,
          data.sampleRate
        );

        channelChildren.push(
          h(
            "div.wp-fade.wp-fadeout",
            {
              attributes: {
                style: `position: absolute; height: ${data.height}px; width: ${fadeWidth}px; top: 0; right: 0; z-index: 4;`,
              },
            },
            [
              h("canvas", {
                attributes: {
                  width: fadeWidth,
                  height: data.height,
                },
                hook: new FadeCanvasHook(
                  fadeOut.type,
                  fadeOut.shape,
                  fadeOut.end - fadeOut.start,
                  data.resolution
                ),
              }),
            ]
          )
        );
      }
      return h(
        `div.channel.channel-${channelNum}`,
        {
          attributes: {
            style: `height: ${data.height}px; width: ${width}px; top: ${
              channelNum * data.height
            }px; left: ${startX}px; position: relative; margin: 0; padding: 0; z-index: 1;`,
            draggable: true,
            id: this.customID,
          },
        },
        channelChildren
      );
    });

    const channelBefore = h(`div.channelbefore.no-pointer-events`, {
      attributes: {
        style: `height: ${data.height}px; width: ${width}px; top: 0; left: calc(${startX}px - ${width}px); position: absolute; margin: 0; padding: 0; z-index: 11;`,
      },
    });

    const channelAfter = h(`div.channelafter.no-pointer-events`, {
      attributes: {
        style: `height: ${data.height}px; width: ${width}px; top: 0; left:calc(${startX}px + ${width}px); position: absolute; margin: 0; padding: 0; z-index: 11;`,
      },
    });

    waveformChildren.push(channelBefore);
    waveformChildren.push(channels);
    waveformChildren.push(channelAfter);
    waveformChildren.push(this.renderOverlay(data));

    // draw cursor selection on active track.
    if (data.isActive === true) {
      const cStartX = secondsToPixels(
        data.timeSelection.start,
        data.resolution,
        data.sampleRate
      );
      const cEndX = secondsToPixels(
        data.timeSelection.end,
        data.resolution,
        data.sampleRate
      );
      const cWidth = cEndX - cStartX + 1;
      const cClassName = cWidth > 1 ? ".segment" : ".point";

      waveformChildren.push(
        h(`div.selection${cClassName}`, {
          attributes: {
            style: `position: absolute; width: ${cWidth}px; bottom: 0; top: 0; left: ${cStartX}px; z-index: 4;`,
          },
        })
      );
    }

    const waveform = h(
      "div.waveform",
      {
        attributes: {
          style: `height: ${numChan * data.height}px; position: relative;`,
        },
      },
      waveformChildren
    );

    const channelChildren = [];
    let channelMargin = 0;

    if (data.controls.show) {
      channelChildren.push(this.renderControls(data));
      channelMargin = data.controls.width;
    }

    channelChildren.push(waveform);

    const audibleClass = data.shouldPlay ? "" : ".silent";
    const customClass =
      this.customClass === undefined ? "" : `.${this.customClass}`;

    return h(
      `div.channel-wrapper${audibleClass}${customClass}`,
      {
        attributes: {
          style: `margin-left: ${channelMargin}px;`,
        },
      },
      channelChildren
    );
  }

  render(data) {
    const laneChildren = [];
    laneChildren.push(this.renderChannelWrapper(data));
    return laneChildren;
  }

  getTrackDetails() {
    const info = {
      src: this.src instanceof Blob ? URL.createObjectURL(this.src) : this.src,
      start: this.startTime,
      end: this.endTime,
      name: this.name,
      lane: this.lane,
      customID: this.customID,
      customClass: this.customClass,
      cuein: this.cueIn,
      cueout: this.cueOut,
      stereoPan: this.stereoPan,
      gain: this.gain,
      effects: this.effectsGraph,
    };

    if (this.fadeIn) {
      const fadeIn = this.fades[this.fadeIn];

      info.fadeIn = {
        shape: fadeIn.shape,
        duration: fadeIn.end - fadeIn.start,
      };
    }

    if (this.fadeOut) {
      const fadeOut = this.fades[this.fadeOut];

      info.fadeOut = {
        shape: fadeOut.shape,
        duration: fadeOut.end - fadeOut.start,
      };
    }

    return info;
  }
}
