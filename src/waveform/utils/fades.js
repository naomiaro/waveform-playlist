'use strict';

import {sCurve, logarithmic} from 'curves';

function sCurveFadeIn(start, duration) {
    var curve = sCurve(10000, (Math.PI/2));
    this.setValueCurveAtTime(curve, start, duration);
}

function sCurveFadeOut(start, duration) {
    var curve = sCurve(10000, -(Math.PI/2));
    this.setValueCurveAtTime(curve, start, duration);
}

function linearFadeIn(start, duration) {
    this.linearRampToValueAtTime(0, start);
    this.linearRampToValueAtTime(1, start + duration);
}

function linearFadeOut(start, duration) {
    this.linearRampToValueAtTime(1, start);
    this.linearRampToValueAtTime(0, start + duration);
}

function exponentialFadeIn(start, duration) {
    this.exponentialRampToValueAtTime(0.01, start);
    this.exponentialRampToValueAtTime(1, start + duration);
}

function exponentialFadeOut(start, duration) {
    this.exponentialRampToValueAtTime(1, start);
    this.exponentialRampToValueAtTime(0.01, start + duration);
}

function logarithmicFadeIn(start, duration) {
    var curve = logarithmic(10000, 10, 1);
    this.setValueCurveAtTime(curve, start, duration);
}

function logarithmicFadeOut(start, duration) {
    var curve = logarithmic(10000, 10, -1);
    this.setValueCurveAtTime(curve, start, duration);
}


export function createFadeIn(gain, type, start, duration) {
    var method = type + "FadeIn",
        fn = this[method];

    fn.call(gain, start, duration);
}

export function createFadeOut(gain, type, start, duration) {
    var method = type + "FadeOut",
        fn = this[method];

    fn.call(gain, start, duration);
}
