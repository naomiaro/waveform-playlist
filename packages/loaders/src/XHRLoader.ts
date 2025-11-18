import { Loader } from './Loader';

export class XHRLoader extends Loader {
  private url: string;

  constructor(src: string, audioContext: BaseAudioContext) {
    super(src, audioContext);
    this.url = src;
  }

  async load(): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open('GET', this.url, true);
      xhr.responseType = 'arraybuffer';

      xhr.addEventListener('progress', (ev) => {
        this.fileProgress(ev);
      });

      xhr.addEventListener('load', async (e) => {
        const target = e.target as XMLHttpRequest;

        if (target.status >= 200 && target.status < 300) {
          try {
            const audioBuffer = await this.fileLoad(target.response);
            resolve(audioBuffer);
          } catch (err) {
            reject(err);
          }
        } else {
          const error = new Error(`HTTP ${target.status}: ${target.statusText}`);
          this.emit('error', error);
          reject(error);
        }
      });

      xhr.addEventListener('error', () => {
        const error = new Error('Network error while loading audio file');
        this.emit('error', error);
        reject(error);
      });

      xhr.addEventListener('abort', () => {
        const error = new Error('Audio file loading was aborted');
        this.emit('error', error);
        reject(error);
      });

      xhr.send();
    });
  }
}
