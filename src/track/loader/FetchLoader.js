import Loader from "./Loader";

export default class extends Loader {
  /**
   * Loads an audio file via fetch API.
   */
  load() {
    return new Promise((resolve, reject) => {
      fetch(this.src)
        .then((data) => data.arrayBuffer())
        .then((arrayBuffer) => super.fetchLoad(arrayBuffer))
        .then((decodedAudio) => resolve(decodedAudio))
        .catch((err) => {
          reject(Error(`Track ${this.src} failed to load with error: ${err}`));
        });
    });
  }
}
