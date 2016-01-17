/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var _peaks = __webpack_require__(1);

	onmessage = function (e) {
	    var peaks = (0, _peaks.extractPeaks)(e.data.samples, e.data.samplesPerPixel);

	    postMessage({
	        type: "Float32",
	        length: peaks.length / 2,
	        data: [peaks]
	    });
	};

/***/ },
/* 1 */
/***/ function(module, exports) {

	'use strict';

	//http://jsperf.com/typed-array-min-max/2
	//plain for loop for finding min/max is way faster than anything else.

	Object.defineProperty(exports, "__esModule", {
	    value: true
	});
	exports.extractPeaks = extractPeaks;

	exports.default = function (buffer, cueIn, cueOut) {
	    var samplesPerPixel = arguments.length <= 3 || arguments[3] === undefined ? 10000 : arguments[3];
	    var isMono = arguments.length <= 4 || arguments[4] === undefined ? false : arguments[4];

	    var numChan = buffer.numberOfChannels;
	    var peaks = [];
	    var c = undefined;
	    var numPeaks = undefined;

	    for (c = 0; c < numChan; c++) {
	        var channel = buffer.getChannelData(c);
	        var slice = channel.subarray(cueIn, cueOut);
	        peaks.push(extractPeaks(slice, samplesPerPixel));
	    }

	    if (isMono && peaks.length > 1) {
	        peaks = makeMono(peaks);
	    }

	    numPeaks = peaks[0].length / 2;

	    return {
	        type: "Float32",
	        length: numPeaks,
	        data: peaks
	    };
	};

	function findMinMax(typeArray) {
	    var min = Infinity;
	    var max = -Infinity;
	    var i = 0;
	    var len = typeArray.length;
	    var curr = undefined;

	    for (; i < len; i++) {
	        curr = typeArray[i];
	        if (min > curr) {
	            min = curr;
	        }
	        if (max < curr) {
	            max = curr;
	        }
	    }

	    return {
	        min: min,
	        max: max
	    };
	}

	/**
	* @param {Float32Array} channel  Audio track frames to calculate peaks from.
	* @param {Number} samplesPerPixel Audio frames per peak
	*/
	function extractPeaks(channel, samplesPerPixel) {

	    var i = undefined;
	    var chanLength = channel.length;
	    var numPeaks = Math.ceil(chanLength / samplesPerPixel);
	    var start = undefined;
	    var end = undefined;
	    var segment = undefined;
	    var max = undefined;
	    var min = undefined;
	    var extrema = undefined;
	    //create interleaved array of min,max
	    var peaks = new Float32Array(numPeaks * 2);

	    for (i = 0; i < numPeaks; i++) {

	        start = i * samplesPerPixel;
	        end = (i + 1) * samplesPerPixel > chanLength ? chanLength : (i + 1) * samplesPerPixel;

	        segment = channel.subarray(start, end);
	        extrema = findMinMax(segment);
	        min = extrema.min;
	        max = extrema.max;

	        peaks[i * 2] = min;
	        peaks[i * 2 + 1] = max;
	    }

	    return peaks;
	}

	function makeMono(channelPeaks) {
	    var numChan = channelPeaks.length;
	    var weight = 1 / numChan;
	    var numPeaks = channelPeaks[0].length / 2;
	    var c = 0;
	    var i = 0;
	    var min = undefined;
	    var max = undefined;
	    var peaks = new Float32Array(numPeaks * 2);

	    for (i = 0; i < numPeaks; i++) {
	        min = 0;
	        max = 0;

	        for (c = 0; c < numChan; c++) {
	            min += weight * channelPeaks[c][i * 2];
	            max += weight * channelPeaks[c][i * 2 + 1];
	        }

	        peaks[i * 2] = min;
	        peaks[i * 2 + 1] = max;
	    }

	    //return in array so channel number counts still work.
	    return [peaks];
	}

/***/ }
/******/ ]);