'use strict';

import {secondsToPixels} from './utils/conversions';

import h from 'virtual-dom/h';

import TimeScaleHook from './render/TimeScaleHook';

export default class {

    constructor(duration, offset, samplesPerPixel, sampleRate) {
        this.duration = duration;
        this.offset = offset;
        this.samplesPerPixel = samplesPerPixel;
        this.sampleRate = sampleRate;

        this.timeinfo = {
            20000: {
                marker: 30000,
                bigStep: 10000,
                smallStep: 5000,
                secondStep: 5
            },
            12000: {
                marker: 15000,
                bigStep: 5000,
                smallStep: 1000,
                secondStep: 1
            },
            10000: {
                marker: 10000,
                bigStep: 5000,
                smallStep: 1000,
                secondStep: 1
            },
            5000: {
                marker: 5000,
                bigStep: 1000,
                smallStep: 500,
                secondStep: 1/2
            },
            2500: {
                marker: 2000,
                bigStep: 1000,
                smallStep: 500,
                secondStep: 1/2
            },
            1500: {
                marker: 2000,
                bigStep: 1000,
                smallStep: 200,
                secondStep: 1/5
            },
            700: {
                marker: 1000,
                bigStep: 500,
                smallStep: 100,
                secondStep: 1/10
            }
        };
    }

    getScaleInfo(resolution) {
        var keys, i, end;

        keys = Object.keys(this.timeinfo).map(function(item) {
            return parseInt(item, 10);
        });

        //make sure keys are numerically sorted.
        keys = keys.sort(function(a, b){return a - b});

        for (i = 0, end = keys.length; i < end; i++) {
           if (resolution <= keys[i]) {
                return this.timeinfo[keys[i]];
            } 
        }
    }

    /*
        Return time in format mm:ss
    */
    formatTime(milliseconds) {
        var out, m, s, seconds;

        seconds = milliseconds/1000;

        s = seconds % 60;
        m = (seconds - s) / 60;

        if (s < 10) {
            s = "0"+s;
        }

        out = m + ":" + s;

        return out;
    }

    render() {
        let widthX = secondsToPixels(this.duration, this.samplesPerPixel, this.sampleRate);
        let pixPerSec = this.sampleRate / this.samplesPerPixel;
        let pixOffset = secondsToPixels(this.offset, this.samplesPerPixel, this.sampleRate);
        let scaleInfo = this.getScaleInfo(this.samplesPerPixel);
        let canvasInfo = {};
        let timeMarkers = [];
        let i;
        let end = widthX + pixOffset;
        let pixIndex;
        let pix;
        let counter = 0;

        for (i = 0; i < end; i = i + pixPerSec * scaleInfo.secondStep) {

            pixIndex = ~~(i);
            pix = pixIndex - pixOffset;

            if (pixIndex >= pixOffset) {
                //put a timestamp every 30 seconds.
                if (scaleInfo.marker && (counter % scaleInfo.marker === 0)) {
                    timeMarkers.push(h("div.time", {attributes: {
                        "style": `position: absolute; left: ${pix}px;`
                    }}, [this.formatTime(counter)] ));

                    canvasInfo[pix] = 10;
                }
                else if (scaleInfo.bigStep && (counter % scaleInfo.bigStep === 0)) {
                    canvasInfo[pix] = 5;
                }
                else if (scaleInfo.smallStep && (counter % scaleInfo.smallStep === 0)) {
                    canvasInfo[pix] = 2;
                }
            }

            counter += 1000 * scaleInfo.secondStep;  
        }

        return h("div.playlist-time-scale", {
            "attributes": {
                "style": "position: relative; left: 0; right: 0; margin-left: 200px;"
            }}, [

            timeMarkers,

            h("canvas", {
                attributes: {
                    "width": widthX,
                    "height": 30,
                    "style": "position: absolute; left: 0; right: 0; top: 0; bottom: 0;"
                },
                "hook": new TimeScaleHook(canvasInfo, this.offset, this.samplesPerPixel, this.duration)
            })
        ]);
    }
}