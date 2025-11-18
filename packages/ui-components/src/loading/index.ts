import { BlobLoader } from './BlobLoader';
import { XHRLoader } from './XHRLoader';

export const load = (src: Blob | string, audioContext = new AudioContext()) => {
  if (src instanceof Blob) {
    return new BlobLoader(src, audioContext).load();
  } else if (typeof src === 'string') {
    return new XHRLoader(src, audioContext).load();
  }

  throw new Error('Unsupported src type');
};
