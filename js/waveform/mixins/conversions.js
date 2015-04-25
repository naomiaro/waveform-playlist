var unitConversions = function() {

  this.samplesToSeconds = function(samples) {
      return samples / this.sampleRate;
  };

  this.secondsToSamples = function(seconds) {
      return Math.ceil(seconds * this.sampleRate);
  };

  this.samplesToPixels = function(samples) {
      return ~~(samples / this.resolution);
  };

  this.pixelsToSamples = function(pixels) {
      return ~~(pixels * this.resolution);
  };

  this.pixelsToSeconds = function(pixels) {
      return pixels * this.resolution / this.sampleRate;
  };

  this.secondsToPixels = function(seconds) {
      return ~~(seconds * this.sampleRate / this.resolution);
  };

  return this;
};