function drawFrame(cc, h2, x, minPeak, maxPeak) {
    let min = Math.abs(minPeak * h2);
    let max = Math.abs(maxPeak * h2);

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
        let h2 = canvas.height/2;

        cc.fillStyle = this.color;

        for (i = 0; i < len; i++) {
            drawFrame(cc, h2, i, channel[i*2], channel[i*2+1]);
        }
    }
}
