'use strict';

import _ from 'lodash';

var defaults = {

    ac: new (window.AudioContext || window.webkitAudioContext),

    resolution: 4096, //resolution - frames per pixel to draw.
    minResolution: 500,
    maxResolution: 20000,
    timeFormat: 'hh:mm:ss.uu',
    mono: true, //whether to draw multiple channels or combine them.
    fadeType: 'logarithmic',

    timescale: false, //whether or not to include the time measure.
    controls: {
        show: false, //whether or not to include the track controls
        width: 150, //width of controls in pixels
    },

    colors: {
    	waveOutlineColor: 'white',
    	timeColor: 'grey',
    	fadeColor: 'black'
    },

    waveHeight: 128, //height of each canvas element a waveform is on.
    state: 'select'
};

export default class {
    constructor(options={}) {
        this.config = _.assign(defaults, options);
    }

    /*
        Start of all getter methods for config.
    */

    isTimeScaleEnabled() {
        return this.config.timescale;
    }

    getFadeType() {
        return this.config.fadeType;
    }

    isMono() {
        return this.config.mono;
    }

    getState() {
        return this.config.state;
    }

    getAudioContext() {
        return this.config.ac;
    }

    getSampleRate() {
        return this.config.ac.sampleRate;
    }

    getCurrentTime() {
        return this.config.ac.currentTime;
    }

    getTimeFormat() {
        return this.config.timeFormat;
    }

    getMinResolution() {
        return this.config.minResolution;
    }

    getMaxResolution() {
        return this.config.maxResolution;
    }

    getResolution() {
        return this.config.resolution;
    }

    getWaveHeight() {
        return this.config.waveHeight;
    }

    getColorScheme() {
        return {
            waveOutlineColor: this.config.waveOutlineColor,
            timeColor: this.config.timeColor,
            fadeColor: this.config.fadeColor,
            selectBorderColor: this.config.selectBorderColor,
            selectBackgroundColor: this.config.selectBackgroundColor, 
        };
    }

    getControlSettings() {
        return {
            show: this.config.controls.show,
            width: this.config.controls.width
        }
    }

    /*
        Start of all setter methods for config.
    */

    setResolution(resolution) {
        this.config.resolution = resolution;
    }

    setTimeFormat(format) {
        this.config.timeFormat = format;
    }

    setFadeType(type) {
        this.config.fadeType = type;
    }

    setMono(bool) {
        this.config.mono = bool;
    }

    setState(state) {
        this.config.state = state;
    }
}
