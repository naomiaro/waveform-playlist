import {pixelsToSeconds} from '../../utils/conversions';
import _throttle from 'lodash/function/throttle';

export default class {
    constructor(track, samplesPerPixel, sampleRate) {
        this.track = track;
        this.samplesPerPixel = samplesPerPixel;
        this.sampleRate = sampleRate;
    }

    mousedown(e) {
        e.preventDefault();

        var el = e.target;
        var startX = e.offsetX;
        let startTime = pixelsToSeconds(startX, this.samplesPerPixel, this.sampleRate);

        this.track.ee.emit('select', startTime, startTime, this.track);

        let emitSelection = (x) => {
            let minX = Math.min(x, startX);
            let maxX = Math.max(x, startX);
            let startTime = pixelsToSeconds(minX, this.samplesPerPixel, this.sampleRate);
            let endTime = pixelsToSeconds(maxX, this.samplesPerPixel, this.sampleRate);

            this.track.ee.emit('select', startTime, endTime, this.track);
        }

        let complete = (e) => {
            e.preventDefault();

            emitSelection(e.offsetX);

            el.onmousemove = el.onmouseup = el.onmouseleave = null;
        };

        //dynamically put an event on the element.
        el.onmousemove = _throttle((e) => {
            e.preventDefault();

            emitSelection(e.offsetX);
        }, 150);

        el.onmouseup = el.onmouseleave = complete;
    }

    getClasses() {
        return ".state-select";
    }

    getEvents() {
        return {
            "mousedown": this.mousedown
        }
    }
}