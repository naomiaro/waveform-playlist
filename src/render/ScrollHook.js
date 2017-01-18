import { secondsToPixels } from '../utils/conversions';

/*
* virtual-dom hook for scrolling the track container.
*/
export default class {
  constructor(playlist) {
    this.playlist = playlist;
  }

  hook(node) {
    if (!this.playlist.isScrolling) {
      const el = node;
      const left = secondsToPixels(
          this.playlist.scrollLeft,
          this.playlist.samplesPerPixel,
          this.playlist.sampleRate,
      );

      el.scrollLeft = left;
    }
  }
}
