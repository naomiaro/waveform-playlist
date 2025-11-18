import { Loader } from './Loader';

class BlobLoader extends Loader {
  src: Blob;
  constructor(src: Blob, audioContext = new AudioContext()) {
    super(src, audioContext);
    this.src = src;
  }
  /*
   * Loads an audio file via a FileReader
   */
  load(): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      if (
        this.src.type.match(/audio.*/) ||
        // added for problems with Firefox mime types + ogg.
        this.src.type.match(/video\/ogg/)
      ) {
        const fr = new FileReader();

        fr.readAsArrayBuffer(this.src);

        fr.addEventListener('progress', (ev) => {
          super.fileProgress(ev);
        });

        fr.addEventListener('load', () => {
          const decoderPromise = super.fileLoad(fr.result as ArrayBuffer);

          decoderPromise
            .then((audioBuffer) => {
              resolve(audioBuffer);
            })
            .catch((e) => {
              reject(e);
            });
        });

        fr.addEventListener('error', (err) => {
          reject(err);
        });
      } else {
        reject(new Error(`Unsupported file type ${this.src.type}`));
      }
    });
  }
}

export { BlobLoader };
