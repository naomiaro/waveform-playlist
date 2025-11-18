import { Loader } from './Loader';

class XHRLoader extends Loader {
  src: string;
  constructor(src: string, audioContext = new AudioContext()) {
    super(src, audioContext);
    this.src = src;
  }
  /**
   * Loads an audio file via XHR.
   */
  load(): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open('GET', this.src, true);
      xhr.responseType = 'arraybuffer';
      xhr.send();

      xhr.addEventListener('progress', (ev) => {
        super.fileProgress(ev);
      });

      xhr.addEventListener('load', (e) => {
        const decoderPromise = super.fileLoad(
          (e.target as XMLHttpRequest).response
        );

        decoderPromise
          .then((audioBuffer) => {
            resolve(audioBuffer);
          })
          .catch((err: Error) => {
            reject(err);
          });
      });

      xhr.addEventListener('error', (err) => {
        reject(err);
      });
    });
  }
}

export { XHRLoader };
