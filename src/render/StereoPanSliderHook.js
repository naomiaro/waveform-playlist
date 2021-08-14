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

    let panOrientation;
    if (this.stereoPan === 0) {
      panOrientation = "Center";
    } else if (this.stereoPan < 0) {
      panOrientation = "Left";
    } else {
      panOrientation = "Right";
    }
    const percentage = `${Math.abs(Math.round(this.stereoPan * 100))}% `;
    stereoPanInput.title = `Pan: ${
      this.stereoPan !== 0 ? percentage : ""
    }${panOrientation}`;
  }
}
