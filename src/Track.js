'use strict';

import _assign from 'lodash/object/assign';
import _forOwn from 'lodash/object/forOwn';

import uuid from 'uuid';
import h from 'virtual-dom/h';

import {secondsToPixels, secondsToSamples} from './utils/conversions';
import extractPeaks from './utils/peaks';
import stateClasses from './track/states';

import CanvasHook from './render/CanvasHook';
import FadeCanvasHook from './render/FadeCanvasHook';

import {FADEIN, FADEOUT} from './utils/fades';

const MAX_CANVAS_WIDTH = 1000;

export default class {

    constructor(name="Untitled") {

        this.name = name;
        this.gain = 1;
        this.fades = {};
        this.peakData = {
            type: "WebAudio",
            mono: true
        };
    }

    setEventEmitter(ee) {
        this.ee = ee;
    }

    setName(name) {
        this.name = name;
    }

    setCues(cueIn, cueOut) {
        if (cueOut < cueIn) {
            throw new Error("cue out cannot be less than cue in");
        }

        this.cueIn = cueIn;
        this.cueOut = cueOut;
        this.duration = this.cueOut - this.cueIn;
    }

    setStartTime(start) {
        if (this.duration === undefined) {
            throw new Error("Must set track cues before start time.");
        }

        this.startTime = start;
        this.endTime = start + this.duration;
    }

    setPlayout(playout) {
        this.playout = playout;
    }

    setEnabledStates(enabledStates={}) {
        let defaultStatesEnabled = {
            'cursor': true,
            'fadein': true,
            'fadeout': true,
            'select': true,
            'shift': true
        };

        this.enabledStates = _assign(defaultStatesEnabled, enabledStates);
    }

    setFadeIn(options={}) {
        let d = {
            "shape": "logarithmic",
            "start": 0,
            "end": this.duration
        };

        if (this.fadeIn) {
            this.removeFade(this.fadeIn);
            this.fadeIn = undefined;
        }

        let fade = _assign(d, options);
        this.fadeIn = this.saveFade(FADEIN, fade.shape, fade.start, fade.end);
    }

    setFadeOut(options={}) {
        let d = {
            "shape": "logarithmic",
            "start": 0,
            "end": this.duration
        };

        if (this.fadeOut) {
            this.removeFade(this.fadeOut);
            this.fadeOut = undefined;
        }

        let fade = _assign(d, options);
        this.fadeOut = this.saveFade(FADEOUT, fade.shape, fade.start, fade.end);
    }

    saveFade(type, shape, start, end) {
        let id = uuid.v4();
        
        this.fades[id] = {
            type: type,
            shape: shape,
            start: start,
            end: end
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
        let cueIn = secondsToSamples(this.cueIn, sampleRate);
        let cueOut = secondsToSamples(this.cueOut, sampleRate);

        this.peaks = extractPeaks(this.buffer, cueIn, cueOut, samplesPerPixel, this.peakData.mono);
    }

    setState(state) {
        this.state = state;
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

    setGainLevel(level) {
        this.gain = level;
        this.playout.setGainLevel(level);
    }

    setMasterGainLevel(level) {
        this.playout.setMasterGainLevel(level);
    }

    /*
        startTime, endTime in seconds (float).
        segment is for a highlighted section in the UI.

        returns a Promise that will resolve when the AudioBufferSource
        is either stopped or plays out naturally.
    */
    schedulePlay(now, startTime, endTime, options) { 
        var start,
            duration,
            relPos,
            when = now,
            segment = (endTime) ? (endTime - startTime) : undefined,
            sourcePromise;

        //1) track has no content to play.
        //2) track does not play in this selection.
        if ((this.endTime <= startTime) || (segment && (startTime + segment) < this.startTime)) {
            //return a resolved promise since this track is technically "stopped".
            return Promise.resolve();
        }

        //track should have something to play if it gets here.

        //the track starts in the future or on the cursor position
        if (this.startTime >= startTime) {
            start = 0;
            when = when + this.startTime - startTime; //schedule additional delay for this audio node.

            if (endTime) {
                segment = segment - (this.startTime - startTime);
                duration = Math.min(segment, this.duration);
            }
            else {
                duration = this.duration;
            }
        }
        else {
            start = startTime - this.startTime;

            if (endTime) {
                duration = Math.min(segment, this.duration - start);
            }
            else {
                duration = this.duration - start;
            }
        }

        start = start + this.cueIn;
        relPos = startTime - this.startTime;

        sourcePromise = this.playout.setUpSource();

        //param relPos: cursor position in seconds relative to this track.
        //can be negative if the cursor is placed before the start of this track etc.
        _forOwn(this.fades, (fade) => {
            let startTime;
            let duration;

            //only apply fade if it's ahead of the cursor.
            if (relPos < fade.end) {
                if (relPos <= fade.start) {
                    startTime = now + (fade.start - relPos);
                    duration = fade.end - fade.start;
                }
                else if (relPos > fade.start && relPos < fade.end) {
                    startTime = now - (relPos - fade.start);
                    duration = fade.end - fade.start;
                }

                switch (fade.type) {
                    case FADEIN:
                        this.playout.applyFadeIn(startTime, duration, fade.shape);
                        break;
                    case FADEOUT:
                        this.playout.applyFadeOut(startTime, duration, fade.shape);
                        break;
                    default:
                        throw new Error("Invalid fade type saved on track.");
                }
            }
        });

        this.playout.setGainLevel(this.gain);
        this.playout.setMasterGainLevel(options.masterGain);
        this.playout.play(when, start, duration);

        return sourcePromise;
    }

    scheduleStop(when=0) {
        this.playout.stop(when);
    }

    renderTimeSelection(data) {
        let startX = secondsToPixels(data.timeSelection.start, data.resolution, data.sampleRate);
        let endX = secondsToPixels(data.timeSelection.end, data.resolution, data.sampleRate);
        let width = endX - startX + 1;
        let className = (width > 1) ? "segment" : "point";

        return h(`div.selection.${className}`, {
            attributes: {
                "style": `position: absolute; width: ${width}px; bottom: 0; top: 0; left: ${startX}px; z-index: 4;`
            }
        });
    }

    renderOverlay(data) {
        let channelPixels = secondsToPixels(data.playlistLength, data.resolution, data.sampleRate);

        let config = {
            attributes: {
                "style": `position: absolute; top: 0; right: 0; bottom: 0; left: 0; width: ${channelPixels}px; z-index: 9;`
            }
        };

        let stateClass = "";

        if (this.enabledStates[this.state]) {
            let state = new stateClasses[this.state](this, data.resolution, data.sampleRate);
            let stateEvents = state.getEvents();

            Object.keys(stateEvents).map((event) => {
                config[`ev-${event}`] = stateEvents[event].bind(state);
            });

            stateClass = state.getClasses();
        }
        //use this overlay for track event cursor position calculations.
        return h(`div.playlist-overlay${stateClass}`, config);
    }

    renderControls(data) {
        let muteClass = data.muted ? ".active" : "";
        let soloClass = data.soloed ? ".active" : "";

        return h("div.controls", {
            attributes: {
                "style": `height: ${data.height}px; width: ${data.controls.width}px; position: absolute; left: 0; z-index: 10;`
            }},
            [
                h("header", [ this.name ]),
                h("div.btn-group", [
                    h(`span.btn.btn-default.btn-xs.btn-mute${muteClass}`, {"ev-click": () => {
                        this.ee.emit("mute", this);
                    }}, [ "Mute" ]),
                    h(`span.btn.btn-default.btn-xs.btn-solo${soloClass}`, {"ev-click": () => {
                        this.ee.emit("solo", this);
                    }}, [ "Solo" ])
                ]),
                h("label", [
                    h("input.volume-slider", {
                        attributes: {
                            "type": "range",
                            "min": 0,
                            "max": 100,
                            "value": 100
                        },
                        "ev-input": (e) => {
                            this.ee.emit("volumechange", e.target.value, this);
                        }
                    })
                ])
            ]
        );
    }

    render(data) {
        let width = secondsToPixels(this.duration, data.resolution, data.sampleRate);
        let playbackX = secondsToPixels(data.playbackSeconds, data.resolution, data.sampleRate);
        let startX = secondsToPixels(this.startTime, data.resolution, data.sampleRate);
        let endX = secondsToPixels(this.endTime, data.resolution, data.sampleRate);
        let progressWidth = 0;

        if (playbackX > 0 && playbackX > startX) {
            if (playbackX < endX) {
                progressWidth = playbackX - startX;
            }
            else {
                progressWidth = width;
            }
        }

        let waveformChildren = [
            h("div.cursor", {attributes: {
                "style": `position: absolute; width: 1px; margin: 0; padding: 0; top: 0; left: ${playbackX}px; bottom: 0; z-index: 5;`
            }})
        ];

        let channels = Object.keys(this.peaks.data).map((channelNum) => {

            let channelChildren = [
                h("div.channel-progress", {attributes: {
                    "style": `position: absolute; width: ${progressWidth}px; height: ${data.height}px; z-index: 2;`
                }})
            ];
            let offset = 0;
            let totalWidth = width;
            let peaks = this.peaks.data[channelNum];

            while (totalWidth > 0) {
                let currentWidth = Math.min(totalWidth, MAX_CANVAS_WIDTH);

                channelChildren.push(h("canvas", {
                    attributes: {
                        "width": currentWidth,
                        "height": data.height,
                        "data-offset": offset,
                        "style": "float: left; position: relative; margin: 0; padding: 0; z-index: 3;"
                    },
                    "hook": new CanvasHook(peaks, offset, data.colors.waveOutlineColor)
                }));

                totalWidth -= currentWidth;
                offset += MAX_CANVAS_WIDTH;
            }

            //if there are fades, display them.
            if (this.fadeIn) {
                let fadeIn = this.fades[this.fadeIn];
                let width = secondsToPixels(fadeIn.end - fadeIn.start, data.resolution, data.sampleRate);

                channelChildren.push(h("div.wp-fade.wp-fadein", {
                    attributes: {
                        "style": `position: absolute; height: ${data.height}px; width: ${width}px; top: 0; left: 0; z-index: 4;`
                    }}, [
                    h("canvas", {
                        attributes: {
                            "width": width,
                            "height": data.height
                        },
                        "hook": new FadeCanvasHook(fadeIn, data.resolution)
                    })
                ]));
            }

            if (this.fadeOut) {
                let fadeOut = this.fades[this.fadeOut];
                let width = secondsToPixels(fadeOut.end - fadeOut.start, data.resolution, data.sampleRate);

                channelChildren.push(h("div.wp-fade.wp-fadeout", {
                    attributes: {
                        "style": `position: absolute; height: ${data.height}px; width: ${width}px; top: 0; right: 0; z-index: 4;`
                    }}, [
                    h("canvas", {
                        attributes: {
                            "width": width,
                            "height": data.height
                        },
                        "hook": new FadeCanvasHook(fadeOut, data.resolution)
                    })
                ]));
            }

            return h(`div.channel.channel-${channelNum}`, {attributes: {
                    "style": `height: ${data.height}px; width: ${width}px; top: 0; left: ${startX}px; position: absolute; margin: 0; padding: 0; z-index: 1;`
                }},
                channelChildren
            );
        });

        let audibleClass = data.masterGain ? "" : ".silent";

        waveformChildren.push(channels);
        waveformChildren.push(this.renderOverlay(data));

        //draw cursor selection on active track.
        if (data.isActive === true) {
            waveformChildren.push(this.renderTimeSelection(data));
        }

        let waveform = h("div.waveform", {
            attributes: {
                "style": `height: ${data.height}px; position: relative;`
            }}, 
            waveformChildren
        );

        let channelChildren = [];
        let channelMargin = 0;

        if (data.controls.show) {
            channelChildren.push(this.renderControls(data));
            channelMargin = data.controls.width;
        }

        channelChildren.push(waveform);

        return h(`div.channel-wrapper${audibleClass}`, {
            attributes: {
                "style": `margin-left: ${channelMargin}px; height: ${data.height}px;`
            }},
            channelChildren
        );
    }
}