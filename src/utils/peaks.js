'use strict';

/**
* @param {Float32Array} channel  Audio track frames to calculate peaks from.
* @param {Number} resolution  Audio frames per peak
*/
function extractPeaks(channel, resolution) {

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

function makeMono(channelPeaks) {
    let numChan = channelPeaks.length;
    let weight = 1 / numChan;
    let channelLength = channelPeaks[0]['minPeaks'].length;
    let c = 0;
    let i = 0;
    let min;
    let max;
    let minPeaks = new Float32Array(channelLength);
    let maxPeaks = new Float32Array(channelLength);

    for (i = 0; i < channelLength; i++) {
        min = 0;
        max = 0;

        for (c = 0; c < numChan; c++) {
            min += weight * channelPeaks[c]['minPeaks'][i];
            max += weight * channelPeaks[c]['maxPeaks'][i];
        }

        minPeaks[i] = min;
        maxPeaks[i] = max;
    }

    //return in array so channel number counts still work.
    return [{
        maxPeaks,
        minPeaks
    }];
}

export default function(buffer, resolution=10000, isMono=false) {
    let numChan = buffer.numberOfChannels;
    let peaks = [];
    let c;

    for (c = 0; c < numChan; c++) {
        let channel = buffer.getChannelData(c);
        peaks.push(extractPeaks(channel, resolution));
    }

    if (isMono) {
        peaks = makeMono(peaks);
    }

    return peaks;
}