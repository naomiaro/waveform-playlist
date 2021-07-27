import { secondsToPixels, pixelsToSeconds } from "../utils/conversions";

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
          playlist.sampleRate
        );

        const timePoint = playlist.isPlaying()
          ? playlist.playbackSeconds
          : playlist.getTimeSelection().start;

        if (
          timePoint < playlist.scrollLeft ||
          timePoint >= playlist.scrollLeft + width
        ) {
          playlist.scrollLeft = Math.min(timePoint, playlist.duration - width);
        }
      }

      const left = secondsToPixels(
        playlist.scrollLeft,
        playlist.samplesPerPixel,
        playlist.sampleRate
      );

      el.scrollLeft = left;
    }
  }
}
