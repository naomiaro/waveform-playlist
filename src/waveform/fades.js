'use strict';

import {sCurve, logarithmic} from 'utils/curves';

function sCurveFadeIn(start, duration) {
    var curve = sCurve(10000, (Math.PI/2));
    this.setValueCurveAtTime(curve, start, duration);
},

function sCurveFadeOut(start, duration) {
    var curve = sCurve(10000, -(Math.PI/2));
    this.setValueCurveAtTime(curve, start, duration);
},

function linearFadeIn(start, duration) {
    this.linearRampToValueAtTime(0, start);
    this.linearRampToValueAtTime(1, start + duration);
},

function linearFadeOut(start, duration) {
    this.linearRampToValueAtTime(1, start);
    this.linearRampToValueAtTime(0, start + duration);
},

function exponentialFadeIn(start, duration) {
    this.exponentialRampToValueAtTime(0.01, start);
    this.exponentialRampToValueAtTime(1, start + duration);
},

function exponentialFadeOut(start, duration) {
    this.exponentialRampToValueAtTime(1, start);
    this.exponentialRampToValueAtTime(0.01, start + duration);
},

function logarithmicFadeIn(start, duration, options) {
    var curve,
        base = options.base;

    base = typeof base !== 'undefined' ? base : 10;

    curve = logarithmic(10000, base, 1);
    this.setValueCurveAtTime(curve, start, duration);
},

function logarithmicFadeOut(start, duration, options) {
    var curve,
        base = options.base;

    base = typeof base !== 'undefined' ? base : 10;

    curve = logarithmic(10000, base, -1);
    this.setValueCurveAtTime(curve, start, duration);
},

/**
    Calls the appropriate fade type with options

    options {
        start,
        duration,
        base (for logarithmic)
    }
*/
export function createFadeIn(gain, type, options) {
    var method = type + "FadeIn",
        fn = this[method];

    fn.call(gain, options.start, options.duration, options);
},

export function createFadeOut(gain, type, options) {
    var method = type + "FadeOut",
        fn = this[method];

    fn.call(gain, options.start, options.duration, options);
}
