'use strict';

/**
* @param {Float32Array} channel  Audio track frames to calculate peaks from.
* @param {Number} resolution  Audio frames per peak
*/
export default function(channel, resolution) {

    var i;
    var chanLength = channel.length;
    var numPeaks = Math.ceil(chanLength / resolution);
    var start;
    var end;
    var segment;
    var max; 
    var min;
    var minPeaks = new Float32Array(numPeaks);
    var maxPeaks = new Float32Array(numPeaks);
    var maxPeak = -Infinity; //used to scale the waveform on the canvas.

    for (i = 0; i < numPeaks; i++) {

        start = i * resolution;
        end = (i + 1) * resolution > chanLength ? chanLength : (i + 1) * resolution;

        segment = channel.subarray(start, end);
        max = Math.max.apply(Math, segment);
        min = Math.max.apply(Math, segment);

        maxPeaks[i] = max;
        minPeaks[i] = min;
        maxPeak = Math.max.apply(Math, [maxPeak, Math.abs(max), Math.abs(min)]);
    }

    return {
        maxPeaks,
        minPeaks,
        maxPeak
    }
}