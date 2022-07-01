import { pixelsToSeconds } from "../../utils/conversions";

export default class {
  constructor(track) {
    this.track = track;
    this.active = false;
  }

  setup(samplesPerPixel, sampleRate) {
    this.samplesPerPixel = samplesPerPixel;
    this.sampleRate = sampleRate;
  }

  emitShift(x, lastShift) {
    const deltaX = x - this.prevX;
    const deltaTime = pixelsToSeconds(
      deltaX,
      this.samplesPerPixel,
      this.sampleRate
    );
    this.prevX = x;
    this.track.ee.emit("shift", deltaTime, this.track, lastShift);
  }

  complete(x) {
    this.emitShift(x, true);
    this.active = false;
  }

  mousedown(e) {
    e.preventDefault();

    this.active = true;
    this.el = e.target;
    this.prevX = e.offsetX;
  }

  mousemove(e) {
    if (this.active) {
      e.preventDefault();
      this.emitShift(e.offsetX, false);
    }
  }

  mouseup(e) {
    if (this.active) {
      e.preventDefault();
      this.complete(e.offsetX);
    }
  }

  mouseleave(e) {
    if (this.active) {
      e.preventDefault();
      this.complete(e.offsetX);
    }
  }

  static getClass() {
    return ".state-shift";
  }

  static getEvents() {
    return ["mousedown", "mousemove", "mouseup", "mouseleave"];
  }
}
