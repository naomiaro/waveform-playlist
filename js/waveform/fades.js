var Fades = function() {};

Fades.prototype.init = function init(sampleRate) {
    
    this.sampleRate = sampleRate;  
}

/*
The setValueCurveAtTime method
Sets an array of arbitrary parameter values starting at the given time for the given duration. The number of values will be scaled to fit into the desired duration.

The values parameter is a Float32Array representing a parameter value curve. These values will apply starting at the given time and lasting for the given duration.

The startTime parameter is the time in the same time coordinate system as AudioContext.currentTime.

The duration parameter is the amount of time in seconds (after the time parameter) where values will be calculated according to the values parameter..

During the time interval: startTime <= t < startTime + duration, values will be calculated:

      v(t) = values[N * (t - startTime) / duration], where N is the length of the values array.
      
After the end of the curve time interval (t >= startTime + duration), the value will remain constant at the final curve value, until there is another automation event (if any).
*/
   
Fades.prototype.sCurveFadeIn = function sCurveFadeIn(gain, start, duration, options) {
    var curve;
        
    curve = Curves.createSCurveBuffer(this.sampleRate, (Math.PI/2));
    gain.setValueCurveAtTime(curve, start, duration);
};

Fades.prototype.sCurveFadeOut = function sCurveFadeOut(gain, start, duration, options) {
    var curve;
        
    curve = Curves.createSCurveBuffer(this.sampleRate, -(Math.PI/2));
    gain.setValueCurveAtTime(curve, start, duration);
};

/*

The linearRampToValueAtTime method
Schedules a linear continuous change in parameter value from the previous scheduled parameter value to the given value.

The value parameter is the value the parameter will linearly ramp to at the given time.

The endTime parameter is the time in the same time coordinate system as AudioContext.currentTime.

The value during the time interval T0 <= t < T1 (where T0 is the time of the previous event and T1 is the endTime parameter passed into this method) will be calculated as:

      v(t) = V0 + (V1 - V0) * ((t - T0) / (T1 - T0))
      
Where V0 is the value at the time T0 and V1 is the value parameter passed into this method.

If there are no more events after this LinearRampToValue event then for t >= T1, v(t) = V1

*/
Fades.prototype.linearFadeIn = function linearFadeIn(gain, start, duration, options) {

    gain.linearRampToValueAtTime(0, start);
    gain.linearRampToValueAtTime(1, start + duration);
};

Fades.prototype.linearFadeOut = function linearFadeOut(gain, start, duration, options) {

    gain.linearRampToValueAtTime(1, start);
    gain.linearRampToValueAtTime(0, start + duration);
};

/*
DOES NOT WORK PROPERLY USING 0

The exponentialRampToValueAtTime method
Schedules an exponential continuous change in parameter value from the previous scheduled parameter value to the given value. Parameters representing filter frequencies and playback rate are best changed exponentially because of the way humans perceive sound.

The value parameter is the value the parameter will exponentially ramp to at the given time. An exception will be thrown if this value is less than or equal to 0, or if the value at the time of the previous event is less than or equal to 0.

The endTime parameter is the time in the same time coordinate system as AudioContext.currentTime.

The value during the time interval T0 <= t < T1 (where T0 is the time of the previous event and T1 is the endTime parameter passed into this method) will be calculated as:

      v(t) = V0 * (V1 / V0) ^ ((t - T0) / (T1 - T0))
      
Where V0 is the value at the time T0 and V1 is the value parameter passed into this method.

If there are no more events after this ExponentialRampToValue event then for t >= T1, v(t) = V1
*/
Fades.prototype.exponentialFadeIn = function exponentialFadeIn(gain, start, duration, options) {

    gain.exponentialRampToValueAtTime(0.01, start);
    gain.exponentialRampToValueAtTime(1, start + duration);
};

Fades.prototype.exponentialFadeOut = function exponentialFadeOut(gain, start, duration, options) {

    gain.exponentialRampToValueAtTime(1, start);
    gain.exponentialRampToValueAtTime(0.01, start + duration);
};

Fades.prototype.logarithmicFadeIn = function logarithmicFadeIn(gain, start, duration, options) {
    var curve,
        base = options.base;

    base = typeof base !== 'undefined' ? base : 10;

    curve = Curves.createLogarithmicBuffer(this.sampleRate, base, 1);
    gain.setValueCurveAtTime(curve, start, duration);
};

Fades.prototype.logarithmicFadeOut = function logarithmicFadeOut(gain, start, duration, options) {
    var curve,
        base = options.base;

    base = typeof base !== 'undefined' ? base : 10;

    curve = Curves.createLogarithmicBuffer(this.sampleRate, base, -1);
    gain.setValueCurveAtTime(curve, start, duration);
};

/**
    Calls the appropriate fade type with options

    options {
        start,
        duration,
        base (for logarithmic)
    }
*/
Fades.prototype.createFadeIn = function createFadeIn(gain, type, options) {
    var method = type + "FadeIn",
        fn = this[method];

    fn.call(this, gain, options.start, options.duration, options);
};

Fades.prototype.createFadeOut = function createFadeOut(gain, type, options) {
    var method = type + "FadeOut",
        fn = this[method];

    fn.call(this, gain, options.start, options.duration, options);
};
