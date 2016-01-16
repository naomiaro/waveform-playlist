'use strict';

import Loader from './Loader';

export default class extends Loader {

    /**
     * Loads an audio file via XHR.
     */
    load() {
        return new Promise((resolve, reject) => {
            console.time('download ' + this.src)
            let xhr = new XMLHttpRequest();

            xhr.open('GET', this.src, true);
            xhr.responseType = 'arraybuffer';
            xhr.send();

            xhr.addEventListener('progress', (e) => {
                super.fileProgress(e);
            });

            xhr.addEventListener('load', (e) => {
                console.timeEnd('download ' + this.src);

                let decoderPromise = super.fileLoad(e);

                decoderPromise.then((audioBuffer) => {
                    resolve(audioBuffer);
                });
            });

            xhr.addEventListener('error', () => {
                reject(Error(`Track ${this.src} failed to load`));
            });
        });
    }
}