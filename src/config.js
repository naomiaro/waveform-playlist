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

    trackscroll: {
        left: 0,
        top: 0
    },

    state: 'select',
    cursorPos: 0 //value is kept in seconds.
};

export default function (config) {
	return _.assign(defaults, config)
}