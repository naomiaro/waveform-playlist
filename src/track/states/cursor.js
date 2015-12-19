import {pixelsToSeconds} from '../../utils/conversions'

/*
    This is used when in 'cursor' state as a mousedown event

    called with 'this' as an intance of Track
*/
function onclick(e) {
    e.preventDefault();

    let startX = e.offsetX;
    let startTime = pixelsToSeconds(startX, this.config.getResolution(), this.sampleRate);
    let ee = this.config.getEventEmitter();

    ee.emit('select', startTime, startTime, this);
}


export default {
	classes: "state-cursor",
	events: {
		onclick
	}
}