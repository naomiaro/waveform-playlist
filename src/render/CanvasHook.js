import BaseHook from './BaseHook';
import {secondsToPixels} from '../utils/conversions';

/*
* virtual-dom hook for drawing to the canvas element.
*/
export default class extends BaseHook {
    constructor(track, resolution, sampleRate, channelNum, offset, color) {
        super(track, resolution, sampleRate);

        this.channelNum = channelNum;
        this.offset = offset;
        this.color = color;
    }

    hook(canvas, propertyName, previousValue) {
        //node is already created.
        if (previousValue !== undefined) {
            return;
        }

        let i = 0;
        let len = secondsToPixels(this.track.duration, this.resolution, this.sampleRate);
        let channel = this.track.peaks[this.channelNum];
        let cc = canvas.getContext('2d');

        cc.fillStyle = this.color;

        for (i, len; i < len; i++) {
            this.track.drawFrame(cc, canvas.height, i, channel.minPeaks[i], channel.maxPeaks[i]);
        }
    }
}
