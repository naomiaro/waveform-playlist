/*
* virtual-dom hook for rendering the time scale canvas.
*/
export default class {
  constructor(tickInfo, offset, samplesPerPixel, duration, colors) {
    this.tickInfo = tickInfo;
    this.offset = offset;
    this.samplesPerPixel = samplesPerPixel;
    this.duration = duration;
    this.colors = colors;
  }

  hook(canvas, prop, prev) {
    // canvas is up to date
    if (prev !== undefined
      && (prev.offset === this.offset)
      && (prev.duration === this.duration)
      && (prev.samplesPerPixel === this.samplesPerPixel)) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = this.colors.timeColor;

    Object.keys(this.tickInfo).forEach((x) => {
      const scaleHeight = this.tickInfo[x];
      const scaleY = height - scaleHeight;
      ctx.fillRect(x, scaleY, 1, scaleHeight);
    });
  }
}
