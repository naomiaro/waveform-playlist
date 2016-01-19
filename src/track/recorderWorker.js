import extractPeaks from './../utils/peaks';

onmessage = function(e) {
	let peaks = extractPeaks(e.data.samples, e.data.samplesPerPixel);

    postMessage(peaks);
}