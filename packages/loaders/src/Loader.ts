import EventEmitter from 'eventemitter3';

export enum LoaderState {
  UNINITIALIZED = 'uninitialized',
  LOADING = 'loading',
  DECODING = 'decoding',
  FINISHED = 'finished',
  ERROR = 'error',
}

export interface LoaderEvents {
  loadprogress: (percentComplete: number, src: string | Blob) => void;
  audiorequeststatechange: (state: LoaderState, src: string | Blob) => void;
  error: (error: Error) => void;
}

export abstract class Loader extends EventEmitter<LoaderEvents> {
  protected src: Blob | string;
  protected ac: BaseAudioContext;
  protected audioRequestState: LoaderState;
  protected audioBuffer?: AudioBuffer;

  constructor(src: Blob | string, audioContext: BaseAudioContext) {
    super();
    this.src = src;
    this.ac = audioContext;
    this.audioRequestState = LoaderState.UNINITIALIZED;
  }

  protected setStateChange(state: LoaderState): void {
    this.audioRequestState = state;
    this.emit('audiorequeststatechange', this.audioRequestState, this.src);
  }

  protected fileProgress(e: ProgressEvent): void {
    let percentComplete = 0;

    if (this.audioRequestState === LoaderState.UNINITIALIZED) {
      this.setStateChange(LoaderState.LOADING);
    }

    if (e.lengthComputable) {
      percentComplete = (e.loaded / e.total) * 100;
    }

    this.emit('loadprogress', percentComplete, this.src);
  }

  protected async fileLoad(audioData: ArrayBuffer): Promise<AudioBuffer> {
    this.setStateChange(LoaderState.DECODING);

    try {
      const audioBuffer = await this.ac.decodeAudioData(audioData);
      this.audioBuffer = audioBuffer;
      this.setStateChange(LoaderState.FINISHED);
      return audioBuffer;
    } catch (err) {
      this.setStateChange(LoaderState.ERROR);
      const error = err instanceof Error ? err : new Error('Failed to decode audio data');
      this.emit('error', error);
      throw error;
    }
  }

  abstract load(): Promise<AudioBuffer>;

  getState(): LoaderState {
    return this.audioRequestState;
  }

  getAudioBuffer(): AudioBuffer | undefined {
    return this.audioBuffer;
  }
}
