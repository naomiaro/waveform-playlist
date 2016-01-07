/*
* virtual-dom hook for rendering the time scale canvas.
*/
export default class {
	constructor(tickInfo, offset, samplesPerPixel, duration) {
        this.tickInfo = tickInfo;
        this.offset = offset;
        this.samplesPerPixel = samplesPerPixel;
        this.duration = duration;
    }

    hook(canvas, prop, prev) {
    	//canvas is up to date
        if (prev !== undefined 
        	&& (prev.offset === this.offset)
        	&& (prev.duration === this.duration)
        	&& (prev.samplesPerPixel === this.samplesPerPixel)) {
            return;
        }

    	let width = canvas.width;
    	let height = canvas.height;
    	let cc = canvas.getContext('2d');

    	cc.clearRect(0, 0, width, height);
    	
        Object.keys(this.tickInfo).forEach((x) => {
        	let scaleHeight = this.tickInfo[x];
        	let scaleY = height - scaleHeight;
        	cc.fillRect(x, scaleY, 1, scaleHeight);
        });
    }
}