'use strict';

import {createFadein, createFadeout} from './utils/fades';

const FADEIN = "FadeIn";
const FADEOUT = "FadeOut";

export default class {

    constructor(AudioContext) {
        this.ac = AudioContext;
        this.gain = 1;
        this.destination = this.ac.destination;
    }

    getBuffer() {
        return this.buffer;
    }

    /**
    * @param {ArrayBuffer} buffer
    */
    setBuffer(buffer) {
        this.buffer = buffer;
    }

    applyFade(type, start, duration, shape="logarithmic") {
        if (type === FADEIN) {
            createFadeIn(this.fadeGain.gain, shape, start, duration);
        }
        else if (type === FADEOUT) {
            createFadeOut(this.fadeGain.gain, shape, start, duration);
        }
        else {
            throw new Error("Unsupported fade type");
        }
    }

    applyFadeIn(start, duration, shape="logarithmic") {
        this.applyFade(FADEIN, start, duration, shape);
    }

    applyFadeOut(start, duration, shape="logarithmic") {
        this.applyFade(FADEOUT, start, duration, shape);
    }

    isPlaying() {
        return this.source !== undefined;
    }

    getDuration() {
        return this.buffer.duration;
    }

    setUpSource() {
        var sourcePromise;

        this.source = this.ac.createBufferSource();
        this.source.buffer = this.buffer;

        sourcePromise = new Promise((resolve, reject) => {
            //keep track of the buffer state.
            this.source.onended = (e) => {
                this.source.disconnect();
                this.fadeGain.disconnect();
                this.outputGain.disconnect();
                this.masterGain.disconnect();

                this.source = undefined;
                this.fadeGain = undefined;
                this.outputGain = undefined;
                this.masterGain = undefined;

                resolve();
            }
        });

        this.fadeGain = this.ac.createGain();
        //used for track volume slider
        this.outputGain = this.ac.createGain();
        //used for solo/mute
        this.masterGain = this.ac.createGain();

        this.source.connect(this.fadeGain);
        this.fadeGain.connect(this.outputGain);
        this.outputGain.connect(this.masterGain);
        this.masterGain.connect(this.destination);

        return sourcePromise;
    }

    setGainLevel(level) {
        this.outputGain && (this.outputGain.gain.value = level);
    }

    setMasterGainLevel(level) {
        this.masterGain && (this.masterGain.gain.value = level);
    }

    /*
        source.start is picky when passing the end time. 
        If rounding error causes a number to make the source think 
        it is playing slightly more samples than it has it won't play at all.
        Unfortunately it doesn't seem to work if you just give it a start time.
    */
    play(start, duration, when=0) {
        this.source.start(when, start, duration);
    }

    stop(when=0) {
        this.source && this.source.stop(when);
    }
}
