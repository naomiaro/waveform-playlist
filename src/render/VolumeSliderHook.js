/* eslint-disable no-param-reassign */
/*
 * virtual-dom hook for setting the volume input programmatically.
 */
export default class {
  constructor(gain) {
    this.gain = gain;
  }

  hook(volumeInput) {
    const gainPercentAge = this.gain * 100;
    const gainPercentageStr = Math.round(gainPercentAge).toString();
    volumeInput.value = gainPercentAge;
    volumeInput.title = `${gainPercentageStr}% volume`;
    volumeInput.dataset.currentValue = gainPercentageStr;
  }
}
