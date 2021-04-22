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

      if (playlist.isAutomaticScroll) {
        const rect = node.getBoundingClientRect();
        const controlWidth = playlist.controls.show
          ? playlist.controls.width
          : 0;
        const width = pixelsToSeconds(
          rect.width - controlWidth,
          playlist.samplesPerPixel,
          playlist.sampleRate,
        );

        if (playlist.isPlaying()) {
          if (playlist.playbackSeconds < playlist.scrollLeft || playlist.playbackSeconds >= (playlist.scrollLeft + width)) {
            playlist.scrollLeft = Math.min(
              playlist.playbackSeconds,
              playlist.duration - width,
            );
          }
        } else {
          const selection = playlist.getTimeSelection();

          if (selection.start < playlist.scrollLeft || selection.start >= (playlist.scrollLeft + width)) {
            playlist.scrollLeft = Math.min(
              selection.start,
              playlist.duration - width,
            );
          }
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
