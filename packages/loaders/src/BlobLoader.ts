import { Loader } from './Loader';

export class BlobLoader extends Loader {
  private blob: Blob;

  constructor(src: Blob, audioContext: BaseAudioContext) {
    super(src, audioContext);
    this.blob = src;
  }

  async load(): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      // Check if the blob is an audio file
      if (
        this.blob.type.match(/audio.*/) ||
        // Added for problems with Firefox mime types + ogg
        this.blob.type.match(/video\/ogg/)
      ) {
        const fr = new FileReader();

        fr.addEventListener('progress', (ev) => {
          this.fileProgress(ev);
        });

        fr.addEventListener('load', async () => {
          try {
            const audioBuffer = await this.fileLoad(fr.result as ArrayBuffer);
            resolve(audioBuffer);
          } catch (err) {
            reject(err);
          }
        });

        fr.addEventListener('error', () => {
          const error = new Error('Failed to read audio file');
          this.emit('error', error);
          reject(error);
        });

        fr.readAsArrayBuffer(this.blob);
      } else {
        const error = new Error(`Unsupported file type: ${this.blob.type}`);
        this.emit('error', error);
        reject(error);
      }
    });
  }
}
