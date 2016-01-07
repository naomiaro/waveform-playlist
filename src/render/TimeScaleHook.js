/*
* virtual-dom hook for rendering the time scale canvas.
*/
export default class {
	constructor(tickInfo) {
        this.tickInfo = tickInfo;
    }

    hook(canvas, propertyName, previousValue) {
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