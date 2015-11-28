'use strict';

import ee from 'event-emitter';

export const STATE_UNINITIALIZED = 0;
export const STATE_LOADING = 1;
export const STATE_DECODING = 2;
export const STATE_FINISHED = 3;

export default class {
    constructor(src, audioContext) {
        this.src = src;
        this.ac = audioContext;
        this.audioRequestState = STATE_UNINITIALIZED;
        this.ee = ee();
    }

    fileProgress(e) {
        let percentComplete = 0;

        if (this.audioRequestState === STATE_UNINITIALIZED) {
            this.audioRequestState = STATE_LOADING;
            this.ee.emit('audiorequeststatechange', this);
        }

        if (e.lengthComputable) {
            percentComplete = e.loaded / e.total * 100;
        }

        this.ee.emit('progress', percentComplete);
    }

    fileLoad(e) {
        let audioData = e.target.response || e.target.result;

        this.audioRequestState = STATE_DECODING;
        this.ee.emit('audiorequeststatechange', this);

        return new Promise((resolve, reject) => {
            this.ac.decodeAudioData(
                audioData,
                (audioBuffer) => {
                    this.audioBuffer = audioBuffer;

                    this.audioRequestState = STATE_FINISHED;
                    this.ee.emit('audiorequeststatechange', this);

                    resolve(audioBuffer);

                },
                (err) => { 
                    reject(Error(`Unable to decode Audio Data for ${this.src}`));
                }
            );
        });
    }
}
