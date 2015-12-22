function drawFrame(cc, height, x, minPeak, maxPeak) {
    let h2 = height / 2;
    let min;
    let max;

    max = Math.abs(maxPeak * h2);
    min = Math.abs(minPeak * h2);

    //draw maxs
    cc.fillRect(x, 0, 1, h2-max);
    //draw mins
    cc.fillRect(x, h2+min, 1, h2-min);
}

/*
* virtual-dom hook for drawing to the canvas element.
*/
export default class {
    constructor(track, channelNum, offset, color) {
        this.track = track;
        this.channelNum = channelNum;
        this.offset = offset;
        this.color = color;
    }

    hook(canvas, propertyName, previousValue) {
        //node is already created.
        if (previousValue !== undefined) {
            return;
        }

        let i;
        let len = canvas.width;
        let channel = this.track.peaks.data[this.channelNum];
        let cc = canvas.getContext('2d');

        cc.fillStyle = this.color;

        for (i = 0; i < len; i++) {
            drawFrame(cc, canvas.height, i, channel[i*2], channel[i*2+1]);
        }
    }
}
