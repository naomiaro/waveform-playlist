WaveformPlaylist.unitConversions = {

    samplesToSeconds: function(samples) {
        return samples / this.sampleRate;
    },

    secondsToSamples: function(seconds) {
        return Math.ceil(seconds * this.sampleRate);
    },

    samplesToPixels: function(samples) {
        return ~~(samples / this.resolution);
    },

    pixelsToSamples: function(pixels) {
        return ~~(pixels * this.resolution);
    },

    pixelsToSeconds: function(pixels) {
        return pixels * this.resolution / this.sampleRate;
    },

    secondsToPixels: function(seconds) {
        return ~~(seconds * this.sampleRate / this.resolution);
    }
};