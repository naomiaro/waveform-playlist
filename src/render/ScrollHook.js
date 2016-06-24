import {secondsToPixels} from '../utils/conversions'

/*
* virtual-dom hook for scrolling the track container.
*/
export default class {
    constructor(track, resolution, sampleRate) {
        this.track = track;
        this.resolution = resolution;
        this.sampleRate = sampleRate;
    }

    hook(trackArea, propertyName, previousValue) {
        trackArea.scrollLeft = secondsToPixels(this.track.scrollLeft, this.resolution, this.sampleRate);
    }
}