export function resampleAudioBuffer(audioBuffer, targetSampleRate) {
  // `ceil` is needed because `length` must be in integer greater than 0 and
  // resampling a single sample to a lower sample rate will yield a value value < 1.
  const length = Math.ceil(audioBuffer.duration * targetSampleRate);
  const ac = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(audioBuffer.numberOfChannels, length, targetSampleRate);
  const src = ac.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(ac.destination);
  src.start();
  return ac.startRendering();
}
