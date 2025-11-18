// src/Loader.ts
import EventEmitter from "eventemitter3";
var LoaderState = /* @__PURE__ */ ((LoaderState2) => {
  LoaderState2["UNINITIALIZED"] = "uninitialized";
  LoaderState2["LOADING"] = "loading";
  LoaderState2["DECODING"] = "decoding";
  LoaderState2["FINISHED"] = "finished";
  LoaderState2["ERROR"] = "error";
  return LoaderState2;
})(LoaderState || {});
var Loader = class extends EventEmitter {
  constructor(src, audioContext) {
    super();
    this.src = src;
    this.ac = audioContext;
    this.audioRequestState = "uninitialized" /* UNINITIALIZED */;
  }
  setStateChange(state) {
    this.audioRequestState = state;
    this.emit("audiorequeststatechange", this.audioRequestState, this.src);
  }
  fileProgress(e) {
    let percentComplete = 0;
    if (this.audioRequestState === "uninitialized" /* UNINITIALIZED */) {
      this.setStateChange("loading" /* LOADING */);
    }
    if (e.lengthComputable) {
      percentComplete = e.loaded / e.total * 100;
    }
    this.emit("loadprogress", percentComplete, this.src);
  }
  async fileLoad(audioData) {
    this.setStateChange("decoding" /* DECODING */);
    try {
      const audioBuffer = await this.ac.decodeAudioData(audioData);
      this.audioBuffer = audioBuffer;
      this.setStateChange("finished" /* FINISHED */);
      return audioBuffer;
    } catch (err) {
      this.setStateChange("error" /* ERROR */);
      const error = err instanceof Error ? err : new Error("Failed to decode audio data");
      this.emit("error", error);
      throw error;
    }
  }
  getState() {
    return this.audioRequestState;
  }
  getAudioBuffer() {
    return this.audioBuffer;
  }
};

// src/XHRLoader.ts
var XHRLoader = class extends Loader {
  constructor(src, audioContext) {
    super(src, audioContext);
    this.url = src;
  }
  async load() {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", this.url, true);
      xhr.responseType = "arraybuffer";
      xhr.addEventListener("progress", (ev) => {
        this.fileProgress(ev);
      });
      xhr.addEventListener("load", async (e) => {
        const target = e.target;
        if (target.status >= 200 && target.status < 300) {
          try {
            const audioBuffer = await this.fileLoad(target.response);
            resolve(audioBuffer);
          } catch (err) {
            reject(err);
          }
        } else {
          const error = new Error(`HTTP ${target.status}: ${target.statusText}`);
          this.emit("error", error);
          reject(error);
        }
      });
      xhr.addEventListener("error", () => {
        const error = new Error("Network error while loading audio file");
        this.emit("error", error);
        reject(error);
      });
      xhr.addEventListener("abort", () => {
        const error = new Error("Audio file loading was aborted");
        this.emit("error", error);
        reject(error);
      });
      xhr.send();
    });
  }
};

// src/BlobLoader.ts
var BlobLoader = class extends Loader {
  constructor(src, audioContext) {
    super(src, audioContext);
    this.blob = src;
  }
  async load() {
    return new Promise((resolve, reject) => {
      if (this.blob.type.match(/audio.*/) || // Added for problems with Firefox mime types + ogg
      this.blob.type.match(/video\/ogg/)) {
        const fr = new FileReader();
        fr.addEventListener("progress", (ev) => {
          this.fileProgress(ev);
        });
        fr.addEventListener("load", async () => {
          try {
            const audioBuffer = await this.fileLoad(fr.result);
            resolve(audioBuffer);
          } catch (err) {
            reject(err);
          }
        });
        fr.addEventListener("error", () => {
          const error = new Error("Failed to read audio file");
          this.emit("error", error);
          reject(error);
        });
        fr.readAsArrayBuffer(this.blob);
      } else {
        const error = new Error(`Unsupported file type: ${this.blob.type}`);
        this.emit("error", error);
        reject(error);
      }
    });
  }
};

// src/LoaderFactory.ts
var LoaderFactory = class {
  static createLoader(src, audioContext) {
    if (typeof src === "string") {
      return new XHRLoader(src, audioContext);
    } else if (src instanceof Blob) {
      return new BlobLoader(src, audioContext);
    } else {
      throw new Error("Invalid audio source. Must be a URL string or Blob.");
    }
  }
};
export {
  BlobLoader,
  Loader,
  LoaderFactory,
  LoaderState,
  XHRLoader
};
//# sourceMappingURL=index.mjs.map