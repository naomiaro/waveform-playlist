import EventEmitter from 'eventemitter3';

declare enum LoaderState {
    UNINITIALIZED = "uninitialized",
    LOADING = "loading",
    DECODING = "decoding",
    FINISHED = "finished",
    ERROR = "error"
}
interface LoaderEvents {
    loadprogress: (percentComplete: number, src: string | Blob) => void;
    audiorequeststatechange: (state: LoaderState, src: string | Blob) => void;
    error: (error: Error) => void;
}
declare abstract class Loader extends EventEmitter<LoaderEvents> {
    protected src: Blob | string;
    protected ac: BaseAudioContext;
    protected audioRequestState: LoaderState;
    protected audioBuffer?: AudioBuffer;
    constructor(src: Blob | string, audioContext: BaseAudioContext);
    protected setStateChange(state: LoaderState): void;
    protected fileProgress(e: ProgressEvent): void;
    protected fileLoad(audioData: ArrayBuffer): Promise<AudioBuffer>;
    abstract load(): Promise<AudioBuffer>;
    getState(): LoaderState;
    getAudioBuffer(): AudioBuffer | undefined;
}

declare class XHRLoader extends Loader {
    private url;
    constructor(src: string, audioContext: BaseAudioContext);
    load(): Promise<AudioBuffer>;
}

declare class BlobLoader extends Loader {
    private blob;
    constructor(src: Blob, audioContext: BaseAudioContext);
    load(): Promise<AudioBuffer>;
}

declare class LoaderFactory {
    static createLoader(src: string | Blob, audioContext: BaseAudioContext): Loader;
}

export { BlobLoader, Loader, type LoaderEvents, LoaderFactory, LoaderState, XHRLoader };
