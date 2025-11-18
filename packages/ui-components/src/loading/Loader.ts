const EventEmitter = require('events');

enum STATE {
  UNINITIALIZED,
  LOADING,
  DECODING,
  FINISHED,
}

class Loader extends EventEmitter {
  src: Blob | string;
  ac: AudioContext;
  audioRequestState: STATE;
  constructor(src: Blob | string, audioContext = new AudioContext()) {
    super();
    this.src = src;
    this.ac = audioContext;
    this.audioRequestState = STATE.UNINITIALIZED;
  }

  setStateChange(state: STATE) {
    this.audioRequestState = state;
    this.emit('audiorequeststatechange', this.audioRequestState, this.src);
  }

  fileProgress(e: ProgressEvent) {
    let percentComplete = 0;

    if (this.audioRequestState === STATE.UNINITIALIZED) {
      this.setStateChange(STATE.LOADING);
    }

    if (e.lengthComputable) {
      percentComplete = (e.loaded / e.total) * 100;
    }

    this.emit('loadprogress', percentComplete, this.src);
  }

  fileLoad(audioData: ArrayBuffer): Promise<AudioBuffer> {
    this.setStateChange(STATE.DECODING);

    return new Promise((resolve, reject) => {
      this.ac.decodeAudioData(
        audioData,
        (audioBuffer) => {
          this.audioBuffer = audioBuffer;
          this.setStateChange(STATE.FINISHED);

          resolve(audioBuffer);
        },
        (err) => {
          reject(err);
        }
      );
    });
  }
}

export { Loader };
