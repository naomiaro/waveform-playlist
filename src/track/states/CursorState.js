import {pixelsToSeconds} from '../../utils/conversions';

export default class {
    constructor(track, samplesPerPixel, sampleRate) {
        this.track = track;
        this.samplesPerPixel = samplesPerPixel;
        this.sampleRate = sampleRate;
    }

    click(e) {
        e.preventDefault();

        let startX = e.offsetX;
        let startTime = pixelsToSeconds(startX, this.samplesPerPixel, this.sampleRate);

        this.track.ee.emit('select', startTime, startTime, this.track);
    }

    getClasses() {
        return ".state-cursor";
    }

    getEvents() {
        return {
            "click": this.click
        }
    }
}