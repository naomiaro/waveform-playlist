import { Loader } from './Loader';
import { XHRLoader } from './XHRLoader';
import { BlobLoader } from './BlobLoader';

export class LoaderFactory {
  static createLoader(src: string | Blob, audioContext: BaseAudioContext): Loader {
    if (typeof src === 'string') {
      return new XHRLoader(src, audioContext);
    } else if (src instanceof Blob) {
      return new BlobLoader(src, audioContext);
    } else {
      throw new Error('Invalid audio source. Must be a URL string or Blob.');
    }
  }
}
