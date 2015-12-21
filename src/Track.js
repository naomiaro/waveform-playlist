'use strict';

import _ from 'lodash';
import uuid from 'uuid';
import h from 'virtual-dom/h';

import {secondsToPixels} from './utils/conversions'
import stateObjects from './track/states';
import CanvasHook from './render/CanvasHook';

const FADEIN = "FadeIn";
const FADEOUT = "FadeOut";

const MAX_CANVAS_WIDTH = 20000;

export default class {

    constructor(name="Untitled") {

        this.name = name;
        this.gain = 1;
    }

    setEventEmitter(ee) {
        this.ee = ee;
    }

    setName(name) {
        this.name = name;
    }

    setCues(cueIn, cueOut) {
        this.cueIn = cueIn;
        this.cueOut = cueOut;
        this.duration = this.cueOut - this.cueIn;
    }

    setStartTime(start) {
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
            'shift': true,
            'record': true
        };

        this.enabledStates = _.assign(defaultStatesEnabled, enabledStates);
    }

    setFades(fades={}) {
        this.fades = fades;
    }

    setPeaks(peaks) {
        this.peaks = peaks;
    }

    setState(state) {
        this.state = stateObjects[state];
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

    removeFadeType(type) {
        _.forOwn(this.fades, (fade, id) => {
            if (fade.type === type) {
                this.removeFade(id);
            }
        });
    }

    isPlaying() {
        return this.playout.isPlaying();
    }

    setGainLevel(level) {
        this.gain = level;
        this.playout.setGainLevel(level);
    }

    setMasterGainLevel(level) {
        this.playout.setMasterGainLevel(gain);
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
        _.forOwn(this.fades, (fade) => {
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
                "style": `position: absolute; width: ${width}px; bottom: 0; top: 0; left: ${startX}px; z-index: 999;`
            }
        });
    }

    renderOverlay(data) {
        let channelPixels = secondsToPixels(data.playlistLength, data.resolution, data.sampleRate);

        let config = {
            attributes: {
                "style": `position: absolute; top: 0; right: 0; bottom: 0; left: 0; width: ${channelPixels}px; z-index: 9999;`
            }
        };

        let stateEvents = this.state.events;

        Object.keys(stateEvents).map((event) => {
            config[`ev-${event}`] = stateEvents[event].bind(this, data.resolution, data.sampleRate);
        });
        //use this overlay for track event cursor position calculations.
        return h("div.playlist-overlay", config);
    }

    render(data) {
        let width = secondsToPixels(this.duration, data.resolution, data.sampleRate);
        let playbackPixels = secondsToPixels(data.playbackSeconds, data.resolution, data.sampleRate);

        let waveformChildren = [
            h("div.cursor", {attributes: {
                "style": `position: absolute; width: 1px; margin: 0; padding: 0; top: 0; left: ${playbackPixels}px; bottom: 0; z-index: 100;`
            }})
        ];

        let channels = Object.keys(this.peaks).map((channelNum) => {
            return h(`div.channel.channel-${channelNum}`, {attributes: {
                "style": `height: ${data.height}px; top: 0; left: 0; position: absolute; margin: 0; padding: 0; z-index: 1;`
            }},
            [
                h("div.channel-progress", {attributes: {
                    "style": `position: absolute; width: ${playbackPixels}px; height: ${data.height}px; z-index: 2;`
                }}),
                h("canvas", {
                    attributes: {
                        "width": width,
                        "height": data.height,
                        "style": "float: left; position: relative; margin: 0; padding: 0; z-index: 3;"
                    },
                    "hook": new CanvasHook(this, data.resolution, data.sampleRate, channelNum, 0, data.colors.waveOutlineColor)
                })
            ]);
        });

        waveformChildren.push(channels);
        waveformChildren.push(this.renderOverlay(data));

        //draw cursor selection on active track.
        if (data.isActive === true) {
            waveformChildren.push(this.renderTimeSelection(data));
        }

        return h("div.channel-wrapper.state-select", {
            attributes: {
                "style": `margin-left: ${data.controls.width}px; height: ${data.height}px;`
            }},
            [
                h("div.controls", {
                    attributes: {
                        "style": `height: ${data.height}px; width: ${data.controls.width}px; position: absolute; left: 0; z-index: 9999;`
                    }},
                    [
                        h("header", [ this.name ]),
                        h("div.btn-group", [
                            h("span.btn.btn-default.btn-xs.btn-mute", [ "Mute" ]),
                            h("span.btn.btn-default.btn-xs.btn-solo", [ "Solo" ])
                        ]),
                        h("label", [
                            h("input.volume-slider", {attributes: {
                                "type": "range",
                                "min": "0",
                                "max": "100",
                                "value": "100"
                            }})
                        ])
                    ]
                ),

                h("div.waveform", {
                    attributes: {
                        "style": `height: ${data.height}px; position: relative;`
                    }}, 
                    waveformChildren
                )
            ]
        );
    }
}