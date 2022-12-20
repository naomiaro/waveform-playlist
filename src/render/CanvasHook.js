import { drawCorner } from "../utils/drawCorner";
/*
 * virtual-dom hook for drawing to the canvas element.
 */
class CanvasHook {
  constructor(
    peaks,
    offset,
    bits,
    color,
    scale,
    height,
    barWidth,
    barGap,
    rounded
  ) {
    this.peaks = peaks;
    // http://stackoverflow.com/questions/6081483/maximum-size-of-a-canvas-element
    this.offset = offset;
    this.color = color;
    this.bits = bits;
    this.scale = scale;
    this.height = height;
    this.barWidth = barWidth;
    this.barGap = barGap;
    this.rounded = rounded;
  }

  static drawFrame(cc, h2, x, minPeak, maxPeak, width, gap, rounded) {
    const min = Math.abs(minPeak * h2);
    const max = Math.abs(maxPeak * h2);

    // draw max
    cc.fillRect(x, 0, width, h2 - max);
    // draw min
    cc.fillRect(x, h2 + min, width, h2 - min);
    // draw gap
    if (gap !== 0) {
      cc.fillRect(x + width, 0, gap, h2 * 2);
    }
    if (rounded) {
      //Draw Top-Left radius
      drawCorner(cc, x, h2 - max, x + width, h2 - max - 0.1, width);
      //Draw Top-Right radius
      drawCorner(cc, x + width, h2 - max, x, h2 - max - 0.1, width);
      //Draw Bottom-Left radius
      drawCorner(cc, x, h2 + min, x + width, h2 + min + 0.1, width);
      //Draw Bottom-Right radius
      drawCorner(cc, x + width, h2 + min, x, h2 + min + 0.1, width);
    }
  }

  hook(canvas, prop, prev) {
    // canvas is up to date
    if (
      prev !== undefined &&
      prev.peaks === this.peaks &&
      prev.scale === this.scale &&
      prev.height === this.height
    ) {
      return;
    }

    const scale = this.scale;
    const len = canvas.width / scale;
    const cc = canvas.getContext("2d");
    const h2 = canvas.height / scale / 2;
    const maxValue = 2 ** (this.bits - 1);
    const width = this.barWidth;
    const gap = this.barGap;
    const rounded = this.rounded;
    const barStart = width + gap;

    cc.clearRect(0, 0, canvas.width, canvas.height);

    cc.save();
    cc.fillStyle = this.color;
    cc.scale(scale, scale);

    for (let pixel = 0; pixel < len; pixel += barStart) {
      const minPeak = this.peaks[(pixel + this.offset) * 2] / maxValue;
      const maxPeak = this.peaks[(pixel + this.offset) * 2 + 1] / maxValue;
      CanvasHook.drawFrame(
        cc,
        h2,
        pixel,
        minPeak,
        maxPeak,
        width,
        gap,
        rounded
      );
    }

    cc.restore();
  }
}

export default CanvasHook;
