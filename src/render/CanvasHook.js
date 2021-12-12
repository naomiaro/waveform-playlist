/*
 * virtual-dom hook for drawing to the canvas element.
 */
class CanvasHook {
  constructor(peaks, offset, bits, color, scale, height, barWidth, barGap) {
    this.peaks = peaks;
    // http://stackoverflow.com/questions/6081483/maximum-size-of-a-canvas-element
    this.offset = offset;
    this.color = color;
    this.bits = bits;
    this.scale = scale;
    this.height = height;
    this.barWidth = barWidth;
    this.barGap = barGap;
  }

  static drawFrame(cc, h2, x, minPeak, maxPeak, width, gap) {
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
    const barStart = width + gap;

    cc.clearRect(0, 0, canvas.width, canvas.height);

    cc.save();
    cc.fillStyle = this.color;
    cc.scale(scale, scale);

    for (let pixel = 0; pixel < len; pixel += barStart) {
      const minPeak = this.peaks[(pixel + this.offset) * 2] / maxValue;
      const maxPeak = this.peaks[(pixel + this.offset) * 2 + 1] / maxValue;
      CanvasHook.drawFrame(cc, h2, pixel, minPeak, maxPeak, width, gap);
    }

    cc.restore();
  }
}

export default CanvasHook;
