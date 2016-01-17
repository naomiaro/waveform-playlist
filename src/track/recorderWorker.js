import {extractPeaks} from './../utils/peaks';

onmessage = function(e) {
	let peaks = extractPeaks(e.data.samples, e.data.samplesPerPixel);

    postMessage({
        type: "Float32",
        length: peaks.length/2,
        data: [peaks]
    });
}