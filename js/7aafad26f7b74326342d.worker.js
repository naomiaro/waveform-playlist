!function(e){function n(t){if(a[t])return a[t].exports;var r=a[t]={exports:{},id:t,loaded:!1};return e[t].call(r.exports,r,r.exports,n),r.loaded=!0,r.exports}var a={};return n.m=e,n.c=a,n.p="js/",n(0)}([function(e,n,a){"use strict";function t(e){return e&&e.__esModule?e:{"default":e}}var r=a(1),s=t(r);onmessage=function(e){var n=(0,s["default"])(e.data.samples,e.data.samplesPerPixel);postMessage(n)}},function(module,exports){"use strict";function findMinMax(e){for(var n,a=1/0,t=-(1/0),r=0,s=e.length;s>r;r++)n=e[r],a>n&&(a=n),n>t&&(t=n);return{min:a,max:t}}function convert(e,n){var a=Math.pow(2,n-1),t=0>e?e*a:e*a-1;return Math.max(-a,Math.min(a-1,t))}function extractPeaks(channel,samplesPerPixel,bits){var i,chanLength=channel.length,numPeaks=Math.ceil(chanLength/samplesPerPixel),start,end,segment,max,min,extrema,peaks=new(eval("Int"+bits+"Array"))(2*numPeaks);for(i=0;numPeaks>i;i++)start=i*samplesPerPixel,end=(i+1)*samplesPerPixel>chanLength?chanLength:(i+1)*samplesPerPixel,segment=channel.subarray(start,end),extrema=findMinMax(segment),min=convert(extrema.min,bits),max=convert(extrema.max,bits),peaks[2*i]=min,peaks[2*i+1]=max;return peaks}function makeMono(channelPeaks,bits){var numChan=channelPeaks.length,weight=1/numChan,numPeaks=channelPeaks[0].length/2,c=0,i=0,min,max,peaks=new(eval("Int"+bits+"Array"))(2*numPeaks);for(i=0;numPeaks>i;i++){for(min=0,max=0,c=0;numChan>c;c++)min+=weight*channelPeaks[c][2*i],max+=weight*channelPeaks[c][2*i+1];peaks[2*i]=min,peaks[2*i+1]=max}return[peaks]}module.exports=function(e,n,a,t,r,s){if(n=n||1e4,s=s||8,a=a||!0,[8,16,32].indexOf(s)<0)throw new Error("Invalid number of bits specified for peaks.");var i,m,l,u,o=e.numberOfChannels,c=[];if("undefined"==typeof e.subarray)for(i=0;o>i;i++)l=e.getChannelData(i),t=t||0,r=r||l.length,u=l.subarray(t,r),c.push(extractPeaks(u,n,s));else t=t||0,r=r||e.length,c.push(extractPeaks(e.subarray(t,r),n,s));return a&&c.length>1&&(c=makeMono(c,s)),m=c[0].length/2,{length:m,data:c,bits:s}}}]);ray of audio to calculate peaks from.
	*/
	function findMinMax(array) {
	    var min = Infinity;
	    var max = -Infinity;
	    var i = 0;
	    var len = array.length;
	    var curr;

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
	        min: min,
	        max: max
	    };
	}

	/**
	* @param {Number} n - peak to convert from float to Int8, Int16 etc.
	* @param {Number} bits - convert to #bits two's complement signed integer
	*/
	function convert(n, bits) {
	    var max = Math.pow(2, bits-1);
	    var v = n < 0 ? n * max : n * max - 1;
	    return Math.max(-max, Math.min(max-1, v));
	}

	/**
	* @param {TypedArray} channel - Audio track frames to calculate peaks from.
	* @param {Number} samplesPerPixel - Audio frames per peak
	*/
	function extractPeaks(channel, samplesPerPixel, bits) {
	    var i;
	    var chanLength = channel.length;
	    var numPeaks = Math.ceil(chanLength / samplesPerPixel);
	    var start;
	    var end;
	    var segment;
	    var max; 
	    var min;
	    var extrema;

	    //create interleaved array of min,max
	    var peaks = new (eval("Int"+bits+"Array"))(numPeaks*2);

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

	function makeMono(channelPeaks, bits) {
	    var numChan = channelPeaks.length;
	    var weight = 1 / numChan;
	    var numPeaks = channelPeaks[0].length / 2;
	    var c = 0;
	    var i = 0;
	    var min;
	    var max;
	    var peaks = new (eval("Int"+bits+"Array"))(numPeaks*2);

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
	module.exports = function(source, samplesPerPixel, isMono, cueIn, cueOut, bits) {
	    samplesPerPixel = samplesPerPixel || 10000;
	    bits = bits || 8;
	    isMono = isMono || true;

	    if ([8, 16, 32].indexOf(bits) < 0) {
	        throw new Error("Invalid number of bits specified for peaks.");
	    }

	    var numChan = source.numberOfChannels;
	    var peaks = [];
	    var c;
	    var numPeaks;
	    var channel;
	    var slice;

	    if (typeof source.subarray === "undefined") {
	        for (c = 0; c < numChan; c++) {
	            channel = source.getChannelData(c);
	            cueIn = cueIn || 0;
	            cueOut = cueOut || channel.length;
	            slice = channel.subarray(cueIn, cueOut);
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
	};

/***/ }
/******/ ]);