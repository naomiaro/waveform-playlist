'use strict';

import Loader from 'Loader';

export default class extends Loader {

    /*
    * Loads an audio file via a FileReader
    */
    load() {
        return new Promise((resolve, reject) => {
            if (this.src.type.match(/audio.*/)) {
                let fr = new FileReader();

                fr.readAsArrayBuffer(this.src);

                fr.addEventListener('progress', (e) => {
                    super.fileProgress(e);
                });

                fr.addEventListener('load', (e) => {
                    let decoderPromise = super.fileLoad(e);

                    decoderPromise.then((audioBuffer) => {
                        resolve(audioBuffer);
                    });
                });

                fr.addEventListener('error', function () {
                    reject(Error("Error reading Blob"));
                });
            }
            else {
                reject(Error(`Unsupported file type ${this.src.type}`));
            }
        });
    }
}