import {extractPeaks} from './../utils/peaks';

onmessage = function(e) {
    postMessage(extractPeaks(e.data.samples, e.data.samplesPerPixel));
}