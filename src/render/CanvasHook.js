/*
* virtual-dom hook for drawing to the canvas element.
*/
export default class {
    constructor(track) {
        this.track = track;
    }

    hook(canvas, propertyName, previousValue) {
        //node is already created.
        if (previousValue !== undefined) {
            return;
        }

        let i = 0;
        let track = this.track;
        let len = track.getPeakLength();
        let channelNum = canvas.dataset.channel;
        let channel = track.peaks[channelNum];
        let cc = canvas.getContext('2d');

        cc.fillStyle = canvas.dataset.waveOutlineColor;

        for (i, len; i < len; i++) {
            track.drawFrame(cc, canvas.height, i, channel.minPeaks[i], channel.maxPeaks[i]);
        }
    }
}
