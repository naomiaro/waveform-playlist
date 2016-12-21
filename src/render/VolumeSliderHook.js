/*
* virtual-dom hook for setting the volume input programmatically.
*/
export default class {
  constructor(gain) {
    this.gain = gain;
  }

  hook(volumeInput) {
    volumeInput.setAttribute('value', this.gain * 100);
  }
}
