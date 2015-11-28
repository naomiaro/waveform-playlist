'use strict';

import BlobLoader from './BlobLoader';
import XHRLoader from './XHRLoader';

export default class {
    static createLoader(src, audioContext) {
        if (src instanceof Blob) {
            return new BlobLoader(src, audioContext);
        }
        else if (src instanceof String) {
        	return new XHRLoader(src, audioContext);
        }
        else {
        	throw new Error("Unsupported src type");
        }
    }
}