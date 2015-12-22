import {pixelsToSeconds} from '../../utils/conversions';

export default class {
    constructor(track, samplesPerPixel, sampleRate) {
        this.track = track;
        this.samplesPerPixel = samplesPerPixel;
        this.sampleRate = sampleRate;
    }

    mousedown(e) {
        e.preventDefault();

        console.log(e);

        let startX = e.offsetX;
        let startTime = pixelsToSeconds(startX, this.samplesPerPixel, this.sampleRate);

        this.track.ee.emit('select', startTime, startTime, this.track);

        // //dynamically put an event on the element.
        // el.onmousemove = function(e) {
        //     e.preventDefault();

        //     var currentX = editor.drawer.findClickedPixel(e),
        //         minX = Math.min(currentX, startX),
        //         maxX = Math.max(currentX, startX),
        //         startTime,
        //         endTime;

        //     startTime = editor.pixelsToSeconds(minX);
        //     endTime = editor.pixelsToSeconds(maxX);
        //     editor.notifySelectUpdate(startTime, endTime);
        // };

        // complete = function(e) {
        //     e.preventDefault();

        //     var endX = editor.drawer.findClickedPixel(e),
        //         minX, maxX,
        //         startTime, endTime;

        //     minX = Math.min(startX, endX);
        //     maxX = Math.max(startX, endX);

        //     startTime = editor.pixelsToSeconds(minX);
        //     endTime = editor.pixelsToSeconds(maxX);
        //     editor.notifySelectUpdate(startTime, endTime, e.shiftKey);

        //     el.onmousemove = el.onmouseup = el.onmouseleave = null;
        // };

        // el.onmouseup = el.onmouseleave = complete;
    }

    getClasses() {
        return ".state-select";
    }
}