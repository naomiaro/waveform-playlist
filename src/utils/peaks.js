'use strict';

/**
* @param {Float32Array} channel  Audio track frames to calculate peaks from.
* @param {Number} samplesPerPixel Audio frames per peak
*/
function extractPeaks(channel, samplesPerPixel) {

    let i;
    let chanLength = channel.length;
    let numPeaks = Math.ceil(chanLength / samplesPerPixel);
    let start;
    let end;
    let segment;
    let max; 
    let min;
    //create interleaved array of min,max
    let peaks = new Float32Array(numPeaks*2);

    for (i = 0; i < numPeaks; i++) {

        start = i * samplesPerPixel;
        end = (i + 1) * samplesPerPixel > chanLength ? chanLength : (i + 1) * samplesPerPixel;

        segment = channel.subarray(start, end);
        min = Math.min.apply(Math, segment);
        max = Math.max.apply(Math, segment);

        peaks[i*2] = min;
        peaks[i*2+1] = max;
    }

    return {
        type: "float",
        length: numPeaks,
        data: peaks
    };
}

function makeMono(channelPeaks) {
    let numChan = channelPeaks.length;
    let weight = 1 / numChan;
    let numPeaks = channelPeaks[0]['length'];
    let c = 0;
    let i = 0;
    let min;
    let max;
    let peaks = new Float32Array(numPeaks*2);

    for (i = 0; i < numPeaks; i++) {
        min = 0;
        max = 0;

        for (c = 0; c < numChan; c++) {
            min += weight * channelPeaks[c]['data'][i*2];
            max += weight * channelPeaks[c]['data'][i*2+1];
        }

        peaks[i*2] = min;
        peaks[i*2+1] = max;
    }

    //return in array so channel number counts still work.
    return {
        type: "float",
        length: numPeaks,
        data: [peaks]
    };
}

export default function(buffer, samplesPerPixel=10000, isMono=false) {
    let numChan = buffer.numberOfChannels;
    let peaks = [];
    let c;

    for (c = 0; c < numChan; c++) {
        let channel = buffer.getChannelData(c);
        peaks.push(extractPeaks(channel, samplesPerPixel));
    }

    if (isMono) {
        peaks = makeMono(peaks);
    }

    return peaks;
}