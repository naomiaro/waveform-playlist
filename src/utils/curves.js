'use strict';

export function linear(length, rotation) {
    var curve = new Float32Array(length),
        i, x,
        scale = length - 1;

    for (i = 0; i < length; i++) {
        x = i / scale;

        if (rotation > 0) {
            curve[i] = x;
        }
        else {
            curve[i] = 1 - x;
        }  
    }

    return curve;
}

export function exponential(length, rotation) {
    var curve = new Float32Array(length),
        i, x,
        scale = length - 1,
        index;

    for (i = 0; i < length; i++) {
        x = i / scale;
        index = rotation > 0 ? i : length - 1 - i;
       
        curve[index] = Math.exp(2 * x - 1) / Math.exp(1);
    }

    return curve;
}

//creating a curve to simulate an S-curve with setValueCurveAtTime.
export function sCurve(length, rotation) {
    var curve = new Float32Array(length),
        i,
        phase = (rotation > 0) ? Math.PI/2 : -(Math.PI/2);

    for (i = 0; i < length; ++i) {
        curve[i] = (Math.sin((Math.PI * i / length) - phase)) / 2 + 0.5;
    }
    return curve;
}

//creating a curve to simulate a logarithmic curve with setValueCurveAtTime.
export function logarithmic(length, base, rotation) {
    var curve = new Float32Array(length),
        index,
        x = 0,
        i;

    for (i = 0; i < length; i++) {
        //index for the curve array.
        index = rotation > 0 ? i : length - 1 - i;

        x = i / length;
        curve[index] = Math.log(1 + base * x) / Math.log(1 + base);
    }

    return curve;
}
