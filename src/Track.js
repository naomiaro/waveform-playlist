'use strict';

import _ from 'lodash';
import uuid from 'uuid';

import peaks from './utils/peaks';
import Playout from './Playout';

const FADEIN = "FadeIn";
const FADEOUT = "FadeOut";

export default class {

    constructor(src, start, end, fades, cues, samplerate, resolution, enabledStates={}) {
        let defaultStatesEnabled = {
            'cursor': true,
            'fadein': true,
            'fadeout': true,
            'select': true,
            'shift': true,
            'record': true
        };

        this.sampleRate = samplerate;
        this.resolution = resolution;
        this.startTime = start;
        this.endTime = end;

        this.active = false;
        this.gain = 1;
        //selected area stored in seconds relative to entire playlist.
        this.selectedArea = undefined;
        this.fades = {};

        this.enabledStates = _.assign(defaultStatesEnabled, enabledStates);

        this.playout = new Playout();
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

    /*
        Cue points are stored internally in the editor as sample indices for highest precision.

        sample at index cueout is not included.
    */
    setCuePoints(cuein, cueout) {
        //need the offset for trimming an already trimmed track.
        var offset = this.cues ? this.cues.cuein : 0,
            buffer = this.getBuffer(),
            cutOff = this.cues ? this.cues.cueout : buffer.length;

        if (cuein < 0) {
            cuein = 0;
        }
        //adjust if the length was inaccurate and cueout is set to a higher sample than we actually have.
        if ((offset + cueout) > cutOff) {
            cueout = cutOff - offset;
        }

        this.cues = {
            cuein: offset + cuein,
            cueout: offset + cueout
        };

        this.duration = (cueout - cuein) / this.sampleRate;
        this.endTime = this.duration + this.startTime;
        this.cuein = this.samplesToSeconds(this.cues.cuein);
        this.cueout = this.samplesToSeconds(this.cues.cueout);
    }

    leaveCurrentState() {
        //leave the past state if it was enabled
        this.currentState && this.currentState.leave();
    }

    setState(state) {
        this.leaveCurrentState();

        if (this.enabledStates[state]) {
            this.currentState = WaveformPlaylist.states[state];
            this.currentState.enter();
        }
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
            cueOffset = this.cues.cuein / this.sampleRate,
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

        start = start + cueOffset;
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

    samplesToSeconds(samples) {
        return samples / this.sampleRate;
    }

    secondsToSamples(seconds) {
        return Math.ceil(seconds * this.sampleRate);
    }

    samplesToPixels(samples) {
        return ~~(samples / this.resolution);
    }

    pixelsToSamples(pixels) {
        return ~~(pixels * this.resolution);
    }

    pixelsToSeconds(pixels) {
        return pixels * this.resolution / this.sampleRate;
    }

    secondsToPixels(seconds) {
        return ~~(seconds * this.sampleRate / this.resolution);
    }
}