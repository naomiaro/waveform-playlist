/* eslint-disable no-param-reassign */
/*
 * virtual-dom hook for setting the volume input programmatically.
 */
export default class {
  constructor(gain) {
    this.gain = gain;
  }

  hook(volumeInput) {
    volumeInput.value = this.gain * 100;
    volumeInput.title = `${Math.round(this.gain * 100)}% volume`;
  }
}
