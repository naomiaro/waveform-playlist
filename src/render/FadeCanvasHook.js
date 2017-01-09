import { FADEIN, FADEOUT, SCURVE, LINEAR, EXPONENTIAL, LOGARITHMIC } from 'fade-maker';
import { sCurve, logarithmic, linear, exponential } from 'fade-curves';

/*
* virtual-dom hook for drawing the fade curve to the canvas element.
*/
class FadeCanvasHook {
  constructor(type, shape, duration, samplesPerPixel) {
    this.type = type;
    this.shape = shape;
    this.duration = duration;
    this.samplesPerPixel = samplesPerPixel;
  }

  static createCurve(shape, type, width) {
    let reflection;
    let curve;

    switch (type) {
      case FADEIN: {
        reflection = 1;
        break;
      }
      case FADEOUT: {
        reflection = -1;
        break;
      }
      default: {
        throw new Error('Unsupported fade type.');
      }
    }

    switch (shape) {
      case SCURVE: {
        curve = sCurve(width, reflection);
        break;
      }
      case LINEAR: {
        curve = linear(width, reflection);
        break;
      }
      case EXPONENTIAL: {
        curve = exponential(width, reflection);
        break;
      }
      case LOGARITHMIC: {
        curve = logarithmic(width, 10, reflection);
        break;
      }
      default: {
        throw new Error('Unsupported fade shape');
      }
    }

    return curve;
  }

  hook(canvas, prop, prev) {
    // node is up to date.
    if (prev !== undefined &&
      prev.shape === this.shape &&
      prev.type === this.type &&
      prev.duration === this.duration &&
      prev.samplesPerPixel === this.samplesPerPixel) {
      return;
    }

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const curve = FadeCanvasHook.createCurve(this.shape, this.type, width);
    const len = curve.length;
    let y = height - (curve[0] * height);

    ctx.strokeStyle = 'black';
    ctx.beginPath();
    ctx.moveTo(0, y);

    for (let i = 1; i < len; i += 1) {
      y = height - (curve[i] * height);
      ctx.lineTo(i, y);
    }
    ctx.stroke();
  }
}

export default FadeCanvasHook;
