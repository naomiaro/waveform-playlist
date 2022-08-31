import { pixelsToSeconds } from "../../utils/conversions";

export default class {
  constructor(track) {
    this.track = track;
    this.active = false;
  }

  static getClass() {
    return ".state-cursor";
  }

  static getEvents() {
    return ["mousedown", "mousemove", "mouseup", "mouseleave", "click"];
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
    this.maxXDifference = Math.max(
      this.maxXDifference,
      Math.abs(this.startX - x)
    );
    this.prevX = x;
    this.track.ee.emit("shift", deltaTime, this.track, lastShift);
  }

  complete(x) {
    if (this.isShift()) {
      this.emitShift(x, true);
      const shiftingParentElement = document.querySelector(".is-shifting");
      if (shiftingParentElement) {
        shiftingParentElement.classList.remove("is-shifting");
      }
    }
    this.active = false;
  }

  mousedown(e) {
    //e.preventDefault();
    this.startTime = new Date().getTime();
    this.active = true;
    this.el = e.target;
    this.prevX = e.offsetX;
    this.startX = e.offsetX;
    this.prevY = e.offsetY;
    this.startY = e.offsetY;
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
        const parentElement = e.target ? e.target.parentElement : undefined;
        if (parentElement && !parentElement.classList.contains("is-shifting")) {
          parentElement.classList.add("is-shifting");
        }
        this.emitShift(e.offsetX, false);
      }
    }
  }

  mouseup(e) {
    if (this.active) {
      e.preventDefault();
      this.complete(e.offsetX);
    }
    if (e.target.classList.contains("hover")) {
      const channelAfter = e.target.previousElementSibling;
      const channelBefore =
        e.target.previousElementSibling.previousElementSibling
          .previousElementSibling;
      channelAfter.classList.add("no-pointer-events");
      channelBefore.classList.add("no-pointer-events");
      e.target.classList.remove("hover");
    }
  }
  mouseleave(e) {
    this.mouseup(e);
  }
}
