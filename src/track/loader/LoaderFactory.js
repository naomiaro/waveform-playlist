import BlobLoader from "./BlobLoader";
import IdentityLoader from "./IdentityLoader";
import XHRLoader from "./XHRLoader";

export default class {
  static createLoader(src, audioContext, ee) {
    if (src instanceof Blob) {
      return new BlobLoader(src, audioContext, ee);
    } else if (src instanceof AudioBuffer) {
      return new IdentityLoader(src, audioContext, ee);
    } else if (typeof src === "string") {
      return new XHRLoader(src, audioContext, ee);
    }

    throw new Error("Unsupported src type");
  }
}
