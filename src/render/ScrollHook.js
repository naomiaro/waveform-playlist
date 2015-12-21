import BaseHook from './BaseHook';
import {secondsToPixels} from '../utils/conversions'

/*
* virtual-dom hook for scrolling the track container.
*/
export default class extends BaseHook {
    hook(trackArea, propertyName, previousValue) {
        trackArea.scrollLeft = secondsToPixels(this.track.scrollLeft, this.resolution, this.sampleRate);
    }
}