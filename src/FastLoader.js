import parser from 'mp3-parser';

/* Copyright (c) 2019, Timothée 'Tim' Pillard, @ziir @tpillard - ISC */

const CHUNK_MAX_SIZE = 1000 * 1000;
const DEFAULT_CONCURRENCY = 4;
const CONCURRENCY =
  ((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 1) > 2
    ? navigator.hardwareConcurrency
    : DEFAULT_CONCURRENCY;

/**
 * Creates a new ArrayBuffer out of two Uint8Arrays
 *
 * @private
 * @param   {Uint8Array}  baseUint8Array  first Uint8Array.
 * @param   {Uint8Array}  buffer          second Uint8Array.
 * @return  {ArrayBuffer}                  The new ArrayBuffer
 */
function makeChunk(array1, array2) {
  const tmp = new Uint8Array(array1.byteLength + array2.byteLength);
  tmp.set(array1, 0);
  tmp.set(array2, array1.byteLength);
  return tmp.buffer;
}

function makeSaveChunk(chunkArrayBuffers, tagsUInt8Array, sourceUInt8Array) {
  return function saveChunk(chunk) {
    chunkArrayBuffers.push(
      makeChunk(
        tagsUInt8Array,
        sourceUInt8Array.subarray(
          chunk.frames[0]._section.offset,
          chunk.frames[chunk.frames.length - 1]._section.offset +
          chunk.frames[chunk.frames.length - 1]._section.byteLength
        )
      )
    );
  };
}

function emptyChunk(chunk) {
  chunk.byteLength = 0;
  chunk.frames.length = 0;
}

function addChunkFrame(chunk, frame) {
  chunk.byteLength = chunk.byteLength + frame._section.byteLength;
  chunk.frames.push(frame);
}

const asyncWorker = (source, items, fn, output) => async () => {
  let next;
  while ((next = items.pop())) {
    output[source.get(next)] = await fn(next);
  }
};

function getArrayBuffer(file) {
  return new Promise((resolve) => {
    let fileReader = new FileReader();
    fileReader.onloadend = () => {
      resolve(fileReader.result);
    };
    fileReader.readAsArrayBuffer(file);
  });
}

// Use a promise wrapper on top of event based syntax
// for browsers (Safari) which do not support promise-based syntax.
function decodeArrayBuffer(audioCtx, arrayBuffer) {
  return new Promise(audioCtx.decodeAudioData.bind(audioCtx, arrayBuffer));
}

async function getFileAudioBuffer(file, audioCtx, options = {}) {
  const arrayBuffer = await getArrayBuffer(file);
  return getArrayBuffer(arrayBuffer, audioCtx, options)
}

async function getAudioBuffer(arrayBuffer, audioCtx, options = {}) {
  const { native = false, concurrency = CONCURRENCY } = options;

  if (native) {
    return decodeArrayBuffer(audioCtx, arrayBuffer);
  }

  const safari = !!window.webkitAudioContext;
  if (safari) {
    return getFileAudioBuffer(file, audioCtx, { native: true });
  }

  const view = new DataView(arrayBuffer);

  const tags = parser.readTags(view);
  const firstFrame = tags.pop();
  const uInt8Array = new Uint8Array(arrayBuffer);
  const tagsUInt8Array = uInt8Array.subarray(0, firstFrame._section.offset);
  const chunkArrayBuffers = [];
  const saveChunk = makeSaveChunk(
    chunkArrayBuffers,
    tagsUInt8Array,
    uInt8Array
  );
  let chunk = { byteLength: 0, frames: [] };
  let next = firstFrame._section.offset + firstFrame._section.byteLength;
  while (next) {
    const frame = parser.readFrame(view, next);
    next = frame && frame._section.nextFrameIndex;

    if (frame) {
      const chunkEnd =
        chunk && chunk.byteLength + frame._section.byteLength >= CHUNK_MAX_SIZE;
      if (chunkEnd) {
        saveChunk(chunk);
        emptyChunk(chunk);
      }

      addChunkFrame(chunk, frame);
    }

    if (chunk && (!frame || !next)) {
      saveChunk(chunk);
    }
  }

  const workers = [];
  const source = new Map(chunkArrayBuffers.map((chunk, idx) => [chunk, idx]));
  const audioBuffers = new Array(chunkArrayBuffers.length);
  const decode = decodeArrayBuffer.bind(null, audioCtx);

  for (let i = 0; i < Math.min(concurrency, source.size); i++) {
    workers.push(
      asyncWorker(source, chunkArrayBuffers, decode, audioBuffers)()
    );
  }
  await Promise.all(workers);

  const { numberOfChannels, sampleRate } = audioBuffers[0];
  let length = audioBuffers.reduce((acc, current) => acc + current.length, 0);

  const audioBuffer = audioCtx.createBuffer(
    numberOfChannels,
    length,
    sampleRate
  );

  for (let j = 0; j < numberOfChannels; j++) {
    const channelData = audioBuffer.getChannelData(j);
    let offset = 0;
    for (let i = 0; i < audioBuffers.length; i++) {
      channelData.set(audioBuffers[i].getChannelData(j), offset);
      offset += audioBuffers[i].length;
    }
  }

  return audioBuffer;
}

export { getAudioBuffer };