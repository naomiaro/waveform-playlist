import {FADEIN, FADEOUT, SCURVE, LINEAR, EXPONENTIAL, LOGARITHMIC} from './../utils/fades';
import {sCurve, logarithmic, linear, exponential} from './../utils/curves';

function createCurve(shape, type, width) {
    let reflection = (type === FADEIN) ? 1 : -1;
    let curve;

    switch(shape) {
        case SCURVE:
            curve = sCurve(width, reflection);
            break;
        case LINEAR:
            curve = linear(width, reflection);
            break;
        case EXPONENTIAL:
            curve = exponential(width, reflection);
            break;
        case LOGARITHMIC:
            curve = logarithmic(width, 10, reflection);
            break;
        default:
            throw new Error("Unsupported Fade type");
    }

    return curve;
}

function drawFadeCurve(ctx, shape, type, width, height) {
    let curve;
    let i;
    let len;
    let y;

    ctx.strokeStyle = "black";
    curve = createCurve(shape, type, width);

    y = height - curve[0] * height;
    ctx.beginPath();
    ctx.moveTo(0, y);

    for (i = 1, len = curve.length; i < len; i++) {
        y = height - curve[i] * height;
        ctx.lineTo(i, y);
    }
    ctx.stroke();
}


/*
* virtual-dom hook for drawing the fade curve to the canvas element.
*/
export default class {
    constructor(type, shape, duration, samplesPerPixel) {
        this.type = type;
        this.shape = shape;
        this.duration = duration;
        this.samplesPerPixel = samplesPerPixel;
    }

    hook(canvas, prop, prev) {
        //node is up to date.
        if (prev !== undefined &&
            prev.shape === this.shape &&
            prev.type === this.type &&
            prev.duration === this.duration &&
            prev.samplesPerPixel === this.samplesPerPixel) {
            return;
        }

        let cc = canvas.getContext('2d');
        drawFadeCurve(cc, this.shape, this.type, canvas.width, canvas.height);
    }
}