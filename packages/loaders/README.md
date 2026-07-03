# @waveform-playlist/loaders

Audio loaders for waveform-playlist — fetch or read a URL, `Blob`, or `File` and decode it into a Web Audio `AudioBuffer`, with progress and state-change events along the way.

## Installation

```bash
npm install @waveform-playlist/loaders
```

## Usage

```typescript
import { LoaderFactory } from '@waveform-playlist/loaders';

const audioContext = new AudioContext();

// Works with a URL string (uses XHRLoader) or a Blob/File (uses BlobLoader)
const loader = LoaderFactory.createLoader('/audio/track.mp3', audioContext);

loader.on('loadprogress', (percentComplete) => {
  console.log(`Loading: ${percentComplete.toFixed(0)}%`);
});

loader.on('audiorequeststatechange', (state) => {
  console.log('State:', state); // 'loading' | 'decoding' | 'finished' | 'error'
});

loader.on('error', (error) => {
  console.error('Failed to load audio:', error.message);
});

const audioBuffer = await loader.load();
console.log(audioBuffer.duration, audioBuffer.numberOfChannels);
```

Loading from a file input (`File` extends `Blob`, so the same factory call routes to `BlobLoader`):

```typescript
const file = fileInput.files[0];
const fileLoader = LoaderFactory.createLoader(file, audioContext);
const buffer = await fileLoader.load();
```

## API

### `LoaderFactory`

```typescript
class LoaderFactory {
  // Returns an XHRLoader for a URL string, a BlobLoader for a Blob/File.
  // Throws if src is neither.
  static createLoader(src: string | Blob, audioContext: BaseAudioContext): Loader;
}
```

### `Loader` (abstract base class)

Both `XHRLoader` and `BlobLoader` extend `Loader`, which extends `EventEmitter` (from `eventemitter3`) and handles the shared `decodeAudioData` step and state tracking.

```typescript
enum LoaderState {
  UNINITIALIZED = 'uninitialized',
  LOADING = 'loading',
  DECODING = 'decoding',
  FINISHED = 'finished',
  ERROR = 'error',
}

interface LoaderEvents {
  loadprogress: (percentComplete: number, src: string | Blob) => void;
  audiorequeststatechange: (state: LoaderState, src: string | Blob) => void;
  error: (error: Error) => void;
}

abstract class Loader {
  constructor(src: Blob | string, audioContext: BaseAudioContext);

  abstract load(): Promise<AudioBuffer>;

  getState(): LoaderState;
  getAudioBuffer(): AudioBuffer | undefined;

  // EventEmitter methods (on/off/once/emit, etc.) over LoaderEvents
}
```

### `XHRLoader`

Loads a URL via `XMLHttpRequest` (`responseType: 'arraybuffer'`), emitting `loadprogress` on the XHR `progress` event and rejecting with a descriptive `Error` on non-2xx status, network error, or abort.

```typescript
class XHRLoader extends Loader {
  constructor(src: string, audioContext: BaseAudioContext);
  load(): Promise<AudioBuffer>;
}
```

### `BlobLoader`

Loads a `Blob` or `File` via `FileReader.readAsArrayBuffer`, emitting `loadprogress` on the reader's `progress` event. Rejects if the blob's MIME type doesn't match `audio/*` (or `video/ogg`, accepted for Firefox's Ogg mistagging).

```typescript
class BlobLoader extends Loader {
  constructor(src: Blob, audioContext: BaseAudioContext);
  load(): Promise<AudioBuffer>;
}
```

## Examples & Documentation

Guides: [naomiaro.github.io/waveform-playlist](https://naomiaro.github.io/waveform-playlist/)

## License

MIT
