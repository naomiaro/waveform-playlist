/*
* virtual-dom hook for scrolling the track container.
*/
export default class {
    constructor(track) {
        this.track = track;
    }

    hook(trackArea, propertyName, previousValue) {
        trackArea.scrollLeft = trackArea.dataset.scrollLeft;
    }
}