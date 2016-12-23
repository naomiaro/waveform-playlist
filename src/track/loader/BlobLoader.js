import Loader from './Loader';

export default class extends Loader {

  /*
  * Loads an audio file via a FileReader
  */
  load() {
    return new Promise((resolve, reject) => {
      if (this.src.type.match(/audio.*/) ||
        // added for problems with Firefox mime types + ogg.
        this.src.type.match(/video\/ogg/)) {
        const fr = new FileReader();

        fr.readAsArrayBuffer(this.src);

        fr.addEventListener('progress', (e) => {
          super.fileProgress(e);
        });

        fr.addEventListener('load', (e) => {
          const decoderPromise = super.fileLoad(e);

          decoderPromise.then((audioBuffer) => {
            resolve(audioBuffer);
          });
        });

        fr.addEventListener('error', (err) => {
          reject(err);
        });
      } else {
        reject(Error(`Unsupported file type ${this.src.type}`));
      }
    });
  }
}
