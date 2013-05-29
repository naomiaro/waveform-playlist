var Curves = {};

Curves.createLinearBuffer = function createLinearBuffer(length, rotation) {
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
};

Curves.createExponentialBuffer = function createExponentialBuffer(length, rotation) {
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
};

//creating a curve to simulate an S-curve with setValueCurveAtTime.
Curves.createSCurveBuffer = function createSCurveBuffer(length, phase) {
    var curve = new Float32Array(length),
        i;

    for (i = 0; i < length; ++i) {
        curve[i] = (Math.sin((Math.PI * i / length) - phase)) /2 + 0.5;
    }
    return curve;
};

//creating a curve to simulate a logarithmic curve with setValueCurveAtTime.
Curves.createLogarithmicBuffer = function createLogarithmicBuffer(length, base, rotation) {
    var curve = new Float32Array(length),
        index,
        key = ""+length+base+rotation,
        store = [],
        x = 0,
        i;

    if (store[key]) {
        return store[key];
    }

    for (i = 0; i < length; i++) {
        //index for the curve array.
        index = rotation > 0 ? i : length - 1 - i;

        x = i / length;
        curve[index] = Math.log(1 + base*x) / Math.log(1 + base);
    }

    store[key] = curve;

    return curve;
};

