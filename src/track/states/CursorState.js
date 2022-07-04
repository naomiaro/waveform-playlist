import {pixelsToSeconds} from "../../utils/conversions";

export default class {

  constructor(track) {
    this.track = track;
    this.active = false;
  }

  setup(samplesPerPixel, sampleRate) {
    this.samplesPerPixel = samplesPerPixel;
    this.sampleRate = sampleRate;
  }

  click(e) {
    e.preventDefault();
    if (!this.shouldMoveSelection()) {
      return;
    }

    const startX = e.offsetX;
    const startTime = pixelsToSeconds(
      startX,
      this.samplesPerPixel,
      this.sampleRate
    );

    this.track.ee.emit("select", startTime, startTime, this.track);
  }

  emitShift(x, lastShift) {
    const deltaX = x - this.prevX;
    const deltaTime = pixelsToSeconds(
      deltaX,
      this.samplesPerPixel,
      this.sampleRate
    );
    this.maxXDifference = Math.max(this.maxXDifference, Math.abs(this.startX - x));
    this.prevX = x;
    this.track.ee.emit("shift", deltaTime, this.track, lastShift);
  }

  complete(x) {
    if (this.isShift()) {
      this.emitShift(x, true);
    }
    this.active = false;
  }

  mousedown(e) {
    e.preventDefault();
    this.startTime = new Date().getTime();
    this.active = true;
    this.el = e.target;
    this.prevX = e.offsetX;
    this.startX = e.offsetX;
    this.maxXDifference = 0;
  }

  shouldMoveSelection() {
    const timeNow = new Date().getTime();
    return timeNow - this.startTime < 300 && this.maxXDifference <= 1;
  }

  isShift() {
    const timeNow = new Date().getTime();
    return timeNow - this.startTime > 100;
  }

  mousemove(e) {
    if (this.active) {
      e.preventDefault();
      if (this.isShift()) {
        this.emitShift(e.offsetX, false);
      }
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
    return ".state-cursor";
  }

  static getEvents() {
    return ["mousedown", "mousemove", "mouseup", "mouseleave", "click"];
  }
}
