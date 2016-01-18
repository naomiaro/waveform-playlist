import {pixelsToSeconds} from '../../utils/conversions';

export default class {
    constructor(track, samplesPerPixel, sampleRate) {
        this.track = track;
        this.samplesPerPixel = samplesPerPixel;
        this.sampleRate = sampleRate;
    }

    click(e) {
        let startX = e.offsetX;
        let time = pixelsToSeconds(startX, this.samplesPerPixel, this.sampleRate);

        if (time > this.track.getStartTime() && time < this.track.getEndTime()) {
            this.track.ee.emit('fadein', time - this.track.getStartTime(), this.track);
        }
    }

    getClasses() {
        return ".state-fadein";
    }

    getEvents() {
        return {
            "click": this.click
        };
    }
}