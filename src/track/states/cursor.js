import {pixelsToSeconds} from '../../utils/conversions';

/*
    This is used when in 'cursor' state as a mousedown event

    called with 'this' as an intance of Track
*/
function click(resolution, sampleRate, e) {
    e.preventDefault();

    let ee = this.config.getEventEmitter();
    let startX = e.offsetX;
    let startTime = pixelsToSeconds(startX, resolution, sampleRate);

    ee.emit('select', startTime, startTime, this);
}


export default {
	classes: "state-cursor",
	events: {
		click
	}
}