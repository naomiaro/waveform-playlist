import { secondsToPixels, pixelsToSeconds } from '../utils/conversions';

/*
 * virtual-dom hook for scrolling the track container.
 */
export default class {
  constructor(playlist) {
    this.playlist = playlist;
  }

  hook(node) {
    const playlist = this.playlist;
    if (!playlist.isScrolling) {
      const el = node;

      if (playlist.isAutomaticScroll && node.querySelector('.cursor')) {
        const rect = node.getBoundingClientRect();
        const cursorRect = node
          .querySelector('.cursor')
          .getBoundingClientRect();

        if (cursorRect.right > rect.right || cursorRect.right < 0) {
          const controlWidth = playlist.controls.show
            ? playlist.controls.width
            : 0;
          const width = pixelsToSeconds(
            rect.right - rect.left,
            playlist.samplesPerPixel,
            playlist.sampleRate,
          );
          playlist.scrollLeft = Math.min(
            playlist.playbackSeconds,
            playlist.duration - (width - controlWidth),
          );
        }
      }

      const left = secondsToPixels(
        playlist.scrollLeft,
        playlist.samplesPerPixel,
        playlist.sampleRate,
      );

      el.scrollLeft = left;
    }
  }
}
