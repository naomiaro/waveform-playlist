/*
    This is used when in 'cursor' state as a mousedown event

    called with 'this' as an intance of Track
*/
function onclick(e) {
    e.preventDefault();

    let startX = e.offsetX;
    let ee = this.config.getEventEmitter();

    ee.emit('select', startX, startX, this);
}


export default {
	classes: "state-cursor",
	events: {
		onclick
	}
}