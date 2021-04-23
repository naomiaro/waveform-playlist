/* eslint-disable no-param-reassign */
/*
 * virtual-dom hook for setting the stereoPan input programmatically.
 */
export default class {
  constructor(stereoPan) {
    this.stereoPan = stereoPan;
  }

  hook(stereoPanInput) {
    stereoPanInput.value = this.stereoPan * 100;
    stereoPanInput.title = this.stereoPan;
  }
}
