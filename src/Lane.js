import _assign from "lodash.assign";
import _forOwn from "lodash.forown";
import Track from "./Track";

export default class {
  constructor() {
    this.name = "Untitled-lane";
    this.id = "";
    this.customClass = undefined;
    this.gain = 1;
    this.volume = 1;
    this.muted = false;
    this.soloed = false;
    this.duration = 0;
    this.endTime = 0;
    this.tracks = [];
  }

  setEventEmitter(ee) {
    this.ee = ee;
  }

  setId(id) {
    this.id = id;
  }

  setName(name) {
    this.name = name;
  }

  setMuted(bool) {
    this.muted = bool;
  }

  setEndTime(endTime) {
    this.endTime = endTime;
  }

  setDuration(duration) {
    this.duration = duration;
  }

  removeTrack(track) {
    const index = this.tracks.indexOf(track);
    if (index > -1) {
      this.tracks.splice(index, 1);
    }
    const endTime =
      this.tracks.length > 0
        ? Math.max(...this.tracks.map((track) => track.endTime))
        : 0;
    this.setEndTime(endTime);
  }

  addTrack(track) {
    this.tracks.push(track);
    const endTime =
      this.tracks.length > 0
        ? Math.max(...this.tracks.map((track) => track.endTime))
        : 0;
    this.setEndTime(endTime);
  }

  getEndTime() {
    return this.endTime;
  }

  getDuration() {
    return this.duration;
  }

  setGainLevel(level) {
    this.gain = level;
  }

  getLaneDetails() {
    const info = {
      id: this.id,
      name: this.name,
      duration: this.duration,
      end: this.endTime,
      customClass: this.customClass,
      gain: this.gain,
      tracks: this.tracks,
    };

    return info;
  }
}
