/*
* virtual-dom base class for hooks.
*/
export default class {
    constructor(track, resolution, sampleRate) {
        this.track = track;
        this.resolution = resolution;
        this.sampleRate = sampleRate;
    }
}