'use strict';

//http://jsperf.com/typed-array-min-max/2
//plain for loop for finding min/max is way faster than anything else.
/**
* @param {TypedArray} array - Subarray of audio to calculate peaks from.
*/
function findMinMax(array) {
    let min = Infinity;
    let max = -Infinity;
    let i = 0;
    let len = array.length;
    let curr;

    for (; i < len; i++) {
        curr = array[i];
        if (min > curr) {
            min = curr;
        }
        if (max < curr) {
            max = curr;
        }
    }

    return {
        min,
        max
    };
}

/**
* @param {Number} n - peak to convert from float to Int8, Int16 etc.
* @param {Number} bits - convert to #bits two's complement signed integer
*/
function convert(n, bits) {
    let max = Math.pow(2, bits-1);
    let v = n < 0 ? n * max : n * max - 1;
    return Math.max(-max, Math.min(max-1, v));
}

/**
* @param {TypedArray} channel - Audio track frames to calculate peaks from.
* @param {Number} samplesPerPixel - Audio frames per peak
*/
function extractPeaks(channel, samplesPerPixel, bits) {
    let i;
    let chanLength = channel.length;
    let numPeaks = Math.ceil(chanLength / samplesPerPixel);
    let start;
    let end;
    let segment;
    let max; 
    let min;
    let extrema;

    //create interleaved array of min,max
    let peaks = new (eval("Int"+bits+"Array"))(numPeaks*2);

    for (i = 0; i < numPeaks; i++) {

        start = i * samplesPerPixel;
        end = (i + 1) * samplesPerPixel > chanLength ? chanLength : (i + 1) * samplesPerPixel;

        segment = channel.subarray(start, end);
        extrema = findMinMax(segment);
        min = convert(extrema.min, bits);
        max = convert(extrema.max, bits);

        peaks[i*2] = min;
        peaks[i*2+1] = max;
    }

    return peaks;
}

function makeMono(channelPeaks, bits=8) {
    let numChan = channelPeaks.length;
    let weight = 1 / numChan;
    let numPeaks = channelPeaks[0].length / 2;
    let c = 0;
    let i = 0;
    let min;
    let max;
    let peaks = new (eval("Int"+bits+"Array"))(numPeaks*2);

    for (i = 0; i < numPeaks; i++) {
        min = 0;
        max = 0;

        for (c = 0; c < numChan; c++) {
            min += weight * channelPeaks[c][i*2];
            max += weight * channelPeaks[c][i*2+1];
        }

        peaks[i*2] = min;
        peaks[i*2+1] = max;
    }

    //return in array so channel number counts still work.
    return [peaks];
}

/**
* @param {AudioBuffer,TypedArray} source - Source of audio samples for peak calculations.
* @param {Number} samplesPerPixel - Number of audio samples per peak.
* @param {Number} cueIn - index in channel to start peak calculations from.
* @param {Number} cueOut - index in channel to end peak calculations from (non-inclusive).
*/
export default function(source, samplesPerPixel=10000, isMono=true, cueIn=undefined, cueOut=undefined, bits=8) {
    if ([8, 16, 32].indexOf(bits) < 0) {
        throw new Error("Invalid number of bits specified for peaks.");
    }

    let numChan = source.numberOfChannels;
    let peaks = [];
    let c;
    let numPeaks;

    console.log(source.constructor.name);

    if (source.constructor.name === 'AudioBuffer') {
        for (c = 0; c < numChan; c++) {
            let channel = source.getChannelData(c);
            cueIn = cueIn || 0;
            cueOut = cueOut || channel.length;
            let slice = channel.subarray(cueIn, cueOut);
            peaks.push(extractPeaks(slice, samplesPerPixel, bits));
        }
    }
    else {
        cueIn = cueIn || 0;
        cueOut = cueOut || source.length;
        peaks.push(extractPeaks(source.subarray(cueIn, cueOut), samplesPerPixel, bits));
    }

    if (isMono && peaks.length > 1) {
        peaks = makeMono(peaks, bits);
    }

    numPeaks = peaks[0].length / 2;

    return {
        length: numPeaks,
        data: peaks,
        bits: bits
    };
}