'use strict';

WaveformPlaylist.fades = {
   
    sCurveFadeIn: function sCurveFadeIn(gain, start, duration, options) {
        var curve;
            
        curve = this.createSCurveBuffer(this.sampleRate, (Math.PI/2));
        gain.setValueCurveAtTime(curve, start, duration);
    },

    sCurveFadeOut: function sCurveFadeOut(gain, start, duration, options) {
        var curve;
            
        curve = this.createSCurveBuffer(this.sampleRate, -(Math.PI/2));
        gain.setValueCurveAtTime(curve, start, duration);
    },

    linearFadeIn: function linearFadeIn(gain, start, duration, options) {

        gain.linearRampToValueAtTime(0, start);
        gain.linearRampToValueAtTime(1, start + duration);
    },

    linearFadeOut: function linearFadeOut(gain, start, duration, options) {

        gain.linearRampToValueAtTime(1, start);
        gain.linearRampToValueAtTime(0, start + duration);
    },

    exponentialFadeIn: function exponentialFadeIn(gain, start, duration, options) {

        gain.exponentialRampToValueAtTime(0.01, start);
        gain.exponentialRampToValueAtTime(1, start + duration);
    },

    exponentialFadeOut: function exponentialFadeOut(gain, start, duration, options) {

        gain.exponentialRampToValueAtTime(1, start);
        gain.exponentialRampToValueAtTime(0.01, start + duration);
    },

    logarithmicFadeIn: function logarithmicFadeIn(gain, start, duration, options) {
        var curve,
            base = options.base;

        base = typeof base !== 'undefined' ? base : 10;

        curve = this.createLogarithmicBuffer(this.sampleRate, base, 1);
        gain.setValueCurveAtTime(curve, start, duration);
    },

    logarithmicFadeOut: function logarithmicFadeOut(gain, start, duration, options) {
        var curve,
            base = options.base;

        base = typeof base !== 'undefined' ? base : 10;

        curve = this.createLogarithmicBuffer(this.sampleRate, base, -1);
        gain.setValueCurveAtTime(curve, start, duration);
    },

    /**
        Calls the appropriate fade type with options

        options {
            start,
            duration,
            base (for logarithmic)
        }
    */
    createFadeIn: function createFadeIn(gain, type, options) {
        var method = type + "FadeIn",
            fn = this[method];

        fn.call(this, gain, options.start, options.duration, options);
    },

    createFadeOut: function createFadeOut(gain, type, options) {
        var method = type + "FadeOut",
            fn = this[method];

        fn.call(this, gain, options.start, options.duration, options);
    }
};

WaveformPlaylist.mixin(WaveformPlaylist.fades, WaveformPlaylist.curves);
