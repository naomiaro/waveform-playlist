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
    constructor(peaks, offset, bits, color) {
        this.peaks = peaks
        this.offset = offset;  //http://stackoverflow.com/questions/6081483/maximum-size-of-a-canvas-element
        this.color = color;
        this.bits = bits;
    }

    hook(canvas, prop, prev) {
        //canvas is up to date
        if (prev !== undefined &&
            (prev.peaks.length === this.peaks.length)) {
            return;
        }

        let i;
        let len = canvas.width;
        let cc = canvas.getContext('2d');
        let h2 = canvas.height / 2;
        let maxValue = Math.pow(2, this.bits-1);

        let minPeak;
        let maxPeak;

        cc.fillStyle = this.color;

        for (i = 0; i < len; i++) {
            minPeak = this.peaks[(i+this.offset)*2] / maxValue;
            maxPeak = this.peaks[(i+this.offset)*2+1] / maxValue;
            drawFrame(cc, h2, i, minPeak, maxPeak);
        }
    }
}
