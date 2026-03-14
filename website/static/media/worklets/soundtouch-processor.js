const BYTES_PER_SAMPLE = 4;
const SAMPLES_PER_FRAME = 2;
const BYTES_PER_FRAME = BYTES_PER_SAMPLE * SAMPLES_PER_FRAME;
const DEFAULT_MAX_FRAMES = 131072;
class FifoSampleBuffer {
  /**
   * Backing ArrayBuffer for sample storage
   */
  _buffer;
  /**
   * Float32Array view of the buffer
   */
  _vector;
  /**
   * Current read position (frame index)
   */
  _position;
  /**
   * Number of frames currently stored
   */
  _frameCount;
  /**
   * Creates a new FifoSampleBuffer
   * @param maxFrames Maximum number of frames for buffer allocation
   */
  constructor(maxFrames = DEFAULT_MAX_FRAMES) {
    this._buffer = new ArrayBuffer(0, {
      maxByteLength: maxFrames * BYTES_PER_FRAME
    });
    this._vector = new Float32Array(this._buffer);
    this._position = 0;
    this._frameCount = 0;
  }
  /**
   * Returns the Float32Array view of the buffer
   */
  get vector() {
    return this._vector;
  }
  /**
   * Returns the current read position (frame index)
   */
  get position() {
    return this._position;
  }
  /**
   * Returns the start sample index for reading
   */
  get startIndex() {
    return this._position * 2;
  }
  /**
   * Returns the number of frames currently stored
   */
  get frameCount() {
    return this._frameCount;
  }
  /**
   * Returns the end sample index for reading
   */
  get endIndex() {
    return (this._position + this._frameCount) * 2;
  }
  /**
   * Clears the buffer and resets position and frame count
   */
  clear() {
    this._vector.fill(0);
    this._position = 0;
    this._frameCount = 0;
  }
  /**
   * Adds empty frames to the buffer
   * @param numFrames Number of frames to add
   */
  put(numFrames) {
    this._frameCount += numFrames;
  }
  /**
   * Adds samples to the buffer from a Float32Array
   * @param samples Source samples (interleaved stereo)
   * @param position Start frame index in source
   * @param numFrames Number of frames to copy (default: all available)
   */
  putSamples(samples, position = 0, numFrames = 0) {
    const sourceOffset = position * 2;
    if (!(numFrames >= 0) || numFrames === 0) {
      numFrames = (samples.length - sourceOffset) / 2;
    }
    const numSamples = numFrames * 2;
    this.ensureCapacity(numFrames + this._frameCount);
    const destOffset = this.endIndex;
    this._vector.set(
      samples.subarray(sourceOffset, sourceOffset + numSamples),
      destOffset
    );
    this._frameCount += numFrames;
  }
  /**
   * Adds samples from another FifoSampleBuffer
   * @param buffer Source buffer
   * @param position Start frame index in source buffer
   * @param numFrames Number of frames to copy (default: all available)
   */
  putBuffer(buffer, position = 0, numFrames = 0) {
    if (!(numFrames >= 0) || numFrames === 0) {
      numFrames = buffer.frameCount - position;
    }
    this.putSamples(buffer.vector, buffer.position + position, numFrames);
  }
  /**
   * Advances the read position and reduces frame count
   * @param numFrames Number of frames to receive (default: all available)
   */
  receive(numFrames) {
    if (numFrames === void 0 || !(numFrames >= 0) || numFrames > this._frameCount) {
      numFrames = this._frameCount;
    }
    this._frameCount -= numFrames;
    this._position += numFrames;
  }
  /**
   * Copies and receives samples into an output array
   * @param output Destination Float32Array
   * @param numFrames Number of frames to copy and receive
   */
  receiveSamples(output, numFrames = 0) {
    const numSamples = numFrames * 2;
    const sourceOffset = this.startIndex;
    output.set(this._vector.subarray(sourceOffset, sourceOffset + numSamples));
    this.receive(numFrames);
  }
  /**
   * Extracts samples into an output array without advancing position
   * @param output Destination Float32Array
   * @param position Start frame index in buffer
   * @param numFrames Number of frames to extract
   */
  extract(output, position = 0, numFrames = 0) {
    const sourceOffset = this.startIndex + position * 2;
    const numSamples = numFrames * 2;
    output.set(this._vector.subarray(sourceOffset, sourceOffset + numSamples));
  }
  /**
   * Ensures the buffer has capacity for at least numFrames
   * @param numFrames Minimum number of frames required
   */
  ensureCapacity(numFrames = 0) {
    const minLength = Math.floor(numFrames * SAMPLES_PER_FRAME);
    if (this._vector.length < minLength) {
      const newByteLength = minLength * BYTES_PER_SAMPLE;
      if (newByteLength <= this._buffer.maxByteLength) {
        this.rewind();
        this._buffer.resize(newByteLength);
        this._vector = new Float32Array(this._buffer);
      } else {
        const newMaxBytes = newByteLength * 2;
        const newBuffer = new ArrayBuffer(newByteLength, {
          maxByteLength: newMaxBytes
        });
        const newVector = new Float32Array(newBuffer);
        newVector.set(this._vector.subarray(this.startIndex, this.endIndex));
        this._buffer = newBuffer;
        this._vector = newVector;
        this._position = 0;
      }
    } else {
      this.rewind();
    }
  }
  /**
   * Ensures buffer has capacity for additional frames
   * @param numFrames Number of additional frames required
   */
  ensureAdditionalCapacity(numFrames = 0) {
    this.ensureCapacity(this._frameCount + numFrames);
  }
  /**
   * Moves all unread samples to the start of the buffer
   */
  rewind() {
    if (this._position > 0) {
      this._vector.set(this._vector.subarray(this.startIndex, this.endIndex));
      this._position = 0;
    }
  }
}
class AbstractFifoSamplePipe {
  /**
   * Input buffer for audio samples
   */
  _inputBuffer;
  /**
   * Output buffer for processed audio samples
   */
  _outputBuffer;
  /**
   * Constructs an AbstractFifoSamplePipe
   * @param createBuffers If true, initializes input and output buffers
   */
  constructor(createBuffers) {
    if (createBuffers) {
      this._inputBuffer = new FifoSampleBuffer();
      this._outputBuffer = new FifoSampleBuffer();
    } else {
      this._inputBuffer = null;
      this._outputBuffer = null;
    }
  }
  /**
   * Gets the input buffer.
   */
  get inputBuffer() {
    return this._inputBuffer;
  }
  /**
   * Sets the input buffer.
   */
  set inputBuffer(inputBuffer) {
    this._inputBuffer = inputBuffer;
  }
  /**
   * Gets the output buffer.
   */
  get outputBuffer() {
    return this._outputBuffer;
  }
  /**
   * Sets the output buffer
   */
  set outputBuffer(outputBuffer) {
    this._outputBuffer = outputBuffer;
  }
  /**
   * Clears both input and output buffers
   */
  clear() {
    this._inputBuffer?.clear();
    this._outputBuffer?.clear();
  }
}
class RateTransposer extends AbstractFifoSamplePipe {
  /**
   * Current rate factor for transposition.
   */
  _rate;
  /**
   * Internal slope accumulator for interpolation.
   */
  slopeCount;
  /**
   * Previous left channel sample for interpolation.
   */
  prevSampleL;
  /**
   * Previous right channel sample for interpolation.
   */
  prevSampleR;
  /**
   * Creates a RateTransposer instance.
   * @param createBuffers Whether to allocate internal buffers.
   */
  constructor(createBuffers) {
    super(createBuffers);
    this.slopeCount = 0;
    this.prevSampleL = 0;
    this.prevSampleR = 0;
    this._rate = 1;
  }
  /**
   * Sets the rate factor for transposition.
   * @param rate Rate factor.
   */
  set rate(rate) {
    this._rate = rate;
  }
  /**
   * Resets internal state for interpolation.
   */
  reset() {
    this.slopeCount = 0;
    this.prevSampleL = 0;
    this.prevSampleR = 0;
  }
  /**
   * Clears buffers and resets internal state.
   */
  clear() {
    super.clear();
    this.reset();
  }
  /**
   * Creates a clone of this RateTransposer with the same rate.
   * @returns Cloned RateTransposer instance.
   */
  clone() {
    const result = new RateTransposer();
    result.rate = this._rate;
    return result;
  }
  /**
   * Processes input buffer and writes transposed samples to output buffer.
   */
  process() {
    const numFrames = this._inputBuffer.frameCount;
    this._outputBuffer.ensureAdditionalCapacity(numFrames / this._rate + 1);
    const numFramesOutput = this.transpose(numFrames);
    this._inputBuffer.receive();
    this._outputBuffer.put(numFramesOutput);
  }
  /**
   * Transposes input samples by the current rate.
   * @param numFrames Number of input frames to transpose.
   * @returns Number of output frames written.
   */
  transpose(numFrames = 0) {
    if (numFrames === 0) {
      return 0;
    }
    const src = this._inputBuffer.vector;
    const srcOffset = this._inputBuffer.startIndex;
    const dest = this._outputBuffer.vector;
    const destOffset = this._outputBuffer.endIndex;
    let used = 0;
    let i = 0;
    while (this.slopeCount < 1) {
      dest[destOffset + 2 * i] = (1 - this.slopeCount) * this.prevSampleL + this.slopeCount * src[srcOffset];
      dest[destOffset + 2 * i + 1] = (1 - this.slopeCount) * this.prevSampleR + this.slopeCount * src[srcOffset + 1];
      i = i + 1;
      this.slopeCount += this._rate;
    }
    this.slopeCount -= 1;
    if (numFrames !== 1) {
      out: while (true) {
        while (this.slopeCount > 1) {
          this.slopeCount -= 1;
          used = used + 1;
          if (used >= numFrames - 1) {
            break out;
          }
        }
        const srcIndex = srcOffset + 2 * used;
        dest[destOffset + 2 * i] = (1 - this.slopeCount) * src[srcIndex] + this.slopeCount * src[srcIndex + 2];
        dest[destOffset + 2 * i + 1] = (1 - this.slopeCount) * src[srcIndex + 1] + this.slopeCount * src[srcIndex + 3];
        i = i + 1;
        this.slopeCount += this._rate;
      }
    }
    this.prevSampleL = src[srcOffset + 2 * numFrames - 2];
    this.prevSampleR = src[srcOffset + 2 * numFrames - 1];
    return i;
  }
}
const USE_AUTO_SEQUENCE_LEN = 0;
const DEFAULT_SEQUENCE_MS = USE_AUTO_SEQUENCE_LEN;
const USE_AUTO_SEEKWINDOW_LEN = 0;
const DEFAULT_SEEKWINDOW_MS = USE_AUTO_SEEKWINDOW_LEN;
const DEFAULT_OVERLAP_MS = 8;
const _SCAN_OFFSETS = [
  [
    124,
    186,
    248,
    310,
    372,
    434,
    496,
    558,
    620,
    682,
    744,
    806,
    868,
    930,
    992,
    1054,
    1116,
    1178,
    1240,
    1302,
    1364,
    1426,
    1488,
    0
  ],
  [
    -100,
    -75,
    -50,
    -25,
    25,
    50,
    75,
    100,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [
    -20,
    -15,
    -10,
    -5,
    5,
    10,
    15,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [-4, -3, -2, -1, 1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];
const AUTOSEQ_TEMPO_LOW = 0.25;
const AUTOSEQ_TEMPO_TOP = 4;
const AUTOSEQ_AT_MIN = 125;
const AUTOSEQ_AT_MAX = 50;
const AUTOSEQ_K = (AUTOSEQ_AT_MAX - AUTOSEQ_AT_MIN) / (AUTOSEQ_TEMPO_TOP - AUTOSEQ_TEMPO_LOW);
const AUTOSEQ_C = AUTOSEQ_AT_MIN - AUTOSEQ_K * AUTOSEQ_TEMPO_LOW;
const AUTOSEEK_AT_MIN = 25;
const AUTOSEEK_AT_MAX = 15;
const AUTOSEEK_K = (AUTOSEEK_AT_MAX - AUTOSEEK_AT_MIN) / (AUTOSEQ_TEMPO_TOP - AUTOSEQ_TEMPO_LOW);
const AUTOSEEK_C = AUTOSEEK_AT_MIN - AUTOSEEK_K * AUTOSEQ_TEMPO_LOW;
class Stretch extends AbstractFifoSamplePipe {
  _quickSeek;
  midBufferDirty;
  midBuffer;
  refMidBuffer;
  overlapLength;
  autoSeqSetting;
  autoSeekSetting;
  _tempo;
  sampleRate;
  overlapMs;
  sequenceMs;
  seekWindowMs;
  seekWindowLength;
  seekLength;
  nominalSkip;
  skipFract;
  sampleReq;
  /**
   * Creates a Stretch instance.
   * @param createBuffers - Whether to allocate internal buffers
   */
  constructor(createBuffers) {
    super(createBuffers);
    this._quickSeek = true;
    this.midBufferDirty = true;
    this.midBuffer = null;
    this.overlapLength = 0;
    this.autoSeqSetting = true;
    this.autoSeekSetting = true;
    this._tempo = 1;
    this.setParameters(
      44100,
      DEFAULT_SEQUENCE_MS,
      DEFAULT_SEEKWINDOW_MS,
      DEFAULT_OVERLAP_MS
    );
  }
  clear() {
    super.clear();
    this.clearMidBuffer();
  }
  clearMidBuffer() {
    this.midBufferDirty = true;
    if (this.midBuffer) {
      this.midBuffer.fill(0);
    }
    if (this.refMidBuffer) {
      this.refMidBuffer.fill(0);
    }
    this.skipFract = 0;
  }
  setParameters(sampleRate, sequenceMs, seekWindowMs, overlapMs) {
    if (sampleRate > 0) {
      this.sampleRate = sampleRate;
    }
    if (overlapMs > 0) {
      this.overlapMs = overlapMs;
    }
    if (sequenceMs > 0) {
      this.sequenceMs = sequenceMs;
      this.autoSeqSetting = false;
    } else {
      this.autoSeqSetting = true;
    }
    if (seekWindowMs > 0) {
      this.seekWindowMs = seekWindowMs;
      this.autoSeekSetting = false;
    } else {
      this.autoSeekSetting = true;
    }
    this.calculateSequenceParameters();
    this.calculateOverlapLength(this.overlapMs);
    this.tempo = this._tempo;
  }
  set tempo(newTempo) {
    this._tempo = newTempo;
    this.calculateSequenceParameters();
    this.nominalSkip = this._tempo * (this.seekWindowLength - this.overlapLength);
    this.skipFract = 0;
    const intskip = Math.floor(this.nominalSkip + 0.5);
    this.sampleReq = Math.max(intskip + this.overlapLength, this.seekWindowLength) + this.seekLength;
  }
  get tempo() {
    return this._tempo;
  }
  get inputChunkSize() {
    return this.sampleReq;
  }
  get outputChunkSize() {
    return this.overlapLength + Math.max(0, this.seekWindowLength - 2 * this.overlapLength);
  }
  calculateOverlapLength(overlapInMsec = 0) {
    let newOvl = this.sampleRate * overlapInMsec / 1e3;
    newOvl = newOvl < 16 ? 16 : newOvl;
    newOvl -= newOvl % 8;
    if (newOvl === this.overlapLength && this.midBuffer !== null) {
      return;
    }
    this.overlapLength = newOvl;
    const needed = this.overlapLength * 2;
    if (!this.refMidBuffer || this.refMidBuffer.length < needed) {
      this.refMidBuffer = new Float32Array(needed);
    }
    if (!this.midBuffer || this.midBuffer.length < needed) {
      this.midBuffer = new Float32Array(needed);
    }
  }
  checkLimits(x, mi, ma) {
    return x < mi ? mi : x > ma ? ma : x;
  }
  calculateSequenceParameters() {
    if (this.autoSeqSetting) {
      let seq = AUTOSEQ_C + AUTOSEQ_K * this._tempo;
      seq = this.checkLimits(seq, AUTOSEQ_AT_MAX, AUTOSEQ_AT_MIN);
      this.sequenceMs = Math.floor(seq + 0.5);
    }
    if (this.autoSeekSetting) {
      let seek = AUTOSEEK_C + AUTOSEEK_K * this._tempo;
      seek = this.checkLimits(seek, AUTOSEEK_AT_MAX, AUTOSEEK_AT_MIN);
      this.seekWindowMs = Math.floor(seek + 0.5);
    }
    this.seekWindowLength = Math.floor(
      this.sampleRate * this.sequenceMs / 1e3
    );
    this.seekLength = Math.floor(this.sampleRate * this.seekWindowMs / 1e3);
  }
  set quickSeek(enable) {
    this._quickSeek = enable;
  }
  clone() {
    const result = new Stretch();
    result.tempo = this._tempo;
    result.setParameters(
      this.sampleRate,
      this.sequenceMs,
      this.seekWindowMs,
      this.overlapMs
    );
    return result;
  }
  seekBestOverlapPosition() {
    return this._quickSeek ? this.seekBestOverlapPositionStereoQuick() : this.seekBestOverlapPositionStereo();
  }
  seekBestOverlapPositionStereo() {
    let bestOffset;
    let bestCorrelation;
    let correlation;
    this.preCalculateCorrelationReferenceStereo();
    bestOffset = 0;
    bestCorrelation = Number.MIN_VALUE;
    for (let i = 0; i < this.seekLength; i++) {
      correlation = this.calculateCrossCorrelationStereo(
        2 * i,
        this.refMidBuffer
      );
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = i;
      }
    }
    return bestOffset;
  }
  seekBestOverlapPositionStereoQuick() {
    let bestOffset;
    let bestCorrelation;
    let correlation;
    let correlationOffset;
    let tempOffset;
    this.preCalculateCorrelationReferenceStereo();
    bestCorrelation = Number.MIN_VALUE;
    bestOffset = 0;
    correlationOffset = 0;
    for (let scanCount = 0; scanCount < 4; scanCount++) {
      let j = 0;
      while (_SCAN_OFFSETS[scanCount][j]) {
        tempOffset = correlationOffset + _SCAN_OFFSETS[scanCount][j];
        if (tempOffset >= this.seekLength) {
          break;
        }
        correlation = this.calculateCrossCorrelationStereo(
          2 * tempOffset,
          this.refMidBuffer
        );
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestOffset = tempOffset;
        }
        j++;
      }
      correlationOffset = bestOffset;
    }
    return bestOffset;
  }
  preCalculateCorrelationReferenceStereo() {
    for (let i = 0; i < this.overlapLength; i++) {
      const temp = i * (this.overlapLength - i);
      const ctx = i * 2;
      this.refMidBuffer[ctx] = this.midBuffer[ctx] * temp;
      this.refMidBuffer[ctx + 1] = this.midBuffer[ctx + 1] * temp;
    }
  }
  calculateCrossCorrelationStereo(mixingPos, compare) {
    const mixing = this._inputBuffer.vector;
    mixingPos += this._inputBuffer.startIndex;
    let correlation = 0;
    const calcLength = 2 * this.overlapLength;
    for (let i = 2; i < calcLength; i += 2) {
      const mixingOffset = i + mixingPos;
      correlation += mixing[mixingOffset] * compare[i] + mixing[mixingOffset + 1] * compare[i + 1];
    }
    return correlation;
  }
  overlap(overlapPosition) {
    this.overlapStereo(2 * overlapPosition);
  }
  overlapStereo(inputPosition) {
    const input = this._inputBuffer.vector;
    inputPosition += this._inputBuffer.startIndex;
    const output = this._outputBuffer.vector;
    const outputPosition = this._outputBuffer.endIndex;
    const frameScale = 1 / this.overlapLength;
    for (let i = 0; i < this.overlapLength; i++) {
      const tempFrame = (this.overlapLength - i) * frameScale;
      const fi = i * frameScale;
      const ctx = 2 * i;
      const inputOffset = ctx + inputPosition;
      const outputOffset = ctx + outputPosition;
      output[outputOffset] = input[inputOffset] * fi + this.midBuffer[ctx] * tempFrame;
      output[outputOffset + 1] = input[inputOffset + 1] * fi + this.midBuffer[ctx + 1] * tempFrame;
    }
  }
  process() {
    if (this.midBufferDirty) {
      if (this._inputBuffer.frameCount < this.overlapLength) {
        return;
      }
      const needed = this.overlapLength * 2;
      if (!this.midBuffer || this.midBuffer.length < needed) {
        this.midBuffer = new Float32Array(needed);
      }
      this._inputBuffer.receiveSamples(this.midBuffer, this.overlapLength);
      this.midBufferDirty = false;
    }
    while (this._inputBuffer.frameCount >= this.sampleReq) {
      const offset = this.seekBestOverlapPosition();
      this._outputBuffer.ensureAdditionalCapacity(this.overlapLength);
      this.overlap(Math.floor(offset));
      this._outputBuffer.put(this.overlapLength);
      const temp = this.seekWindowLength - 2 * this.overlapLength;
      if (temp > 0) {
        this._outputBuffer.putBuffer(
          this._inputBuffer,
          offset + this.overlapLength,
          temp
        );
      }
      const start = this._inputBuffer.startIndex + 2 * (offset + this.seekWindowLength - this.overlapLength);
      this.midBuffer.set(
        this._inputBuffer.vector.subarray(
          start,
          start + 2 * this.overlapLength
        )
      );
      this.skipFract += this.nominalSkip;
      const overlapSkip = Math.floor(this.skipFract);
      this.skipFract -= overlapSkip;
      this._inputBuffer.receive(overlapSkip);
    }
  }
}
function testFloatEqual(a, b) {
  return (a > b ? a - b : b - a) > 1e-10;
}
class SoundTouch {
  transposer;
  stretch;
  _inputBuffer;
  _intermediateBuffer;
  _outputBuffer;
  _rate;
  _tempo;
  virtualPitch;
  virtualRate;
  virtualTempo;
  /**
   * Creates a new SoundTouch processor instance.
   */
  constructor() {
    this.transposer = new RateTransposer(false);
    this.stretch = new Stretch(false);
    this._inputBuffer = new FifoSampleBuffer();
    this._intermediateBuffer = new FifoSampleBuffer();
    this._outputBuffer = new FifoSampleBuffer();
    this._rate = 0;
    this._tempo = 0;
    this.virtualPitch = 1;
    this.virtualRate = 1;
    this.virtualTempo = 1;
    this.calculateEffectiveRateAndTempo();
  }
  clear() {
    this.transposer.clear();
    this.stretch.clear();
  }
  clone() {
    const result = new SoundTouch();
    result.rate = this.rate;
    result.tempo = this.tempo;
    return result;
  }
  get rate() {
    return this._rate;
  }
  set rate(rate) {
    this.virtualRate = rate;
    this.calculateEffectiveRateAndTempo();
  }
  set rateChange(rateChange) {
    this._rate = 1 + 0.01 * rateChange;
  }
  get tempo() {
    return this._tempo;
  }
  set tempo(tempo) {
    this.virtualTempo = tempo;
    this.calculateEffectiveRateAndTempo();
  }
  set tempoChange(tempoChange) {
    this.tempo = 1 + 0.01 * tempoChange;
  }
  set pitch(pitch) {
    this.virtualPitch = pitch;
    this.calculateEffectiveRateAndTempo();
  }
  set pitchOctaves(pitchOctaves) {
    this.pitch = Math.exp(0.69314718056 * pitchOctaves);
    this.calculateEffectiveRateAndTempo();
  }
  set pitchSemitones(pitchSemitones) {
    this.pitchOctaves = pitchSemitones / 12;
  }
  get inputBuffer() {
    return this._inputBuffer;
  }
  get outputBuffer() {
    return this._outputBuffer;
  }
  calculateEffectiveRateAndTempo() {
    const previousTempo = this._tempo;
    const previousRate = this._rate;
    this._tempo = this.virtualTempo / this.virtualPitch;
    this._rate = this.virtualRate * this.virtualPitch;
    if (testFloatEqual(this._tempo, previousTempo)) {
      this.stretch.tempo = this._tempo;
    }
    if (testFloatEqual(this._rate, previousRate)) {
      this.transposer.rate = this._rate;
    }
    if (this._rate > 1) {
      if (this._outputBuffer !== this.transposer.outputBuffer) {
        this.stretch.inputBuffer = this._inputBuffer;
        this.stretch.outputBuffer = this._intermediateBuffer;
        this.transposer.inputBuffer = this._intermediateBuffer;
        this.transposer.outputBuffer = this._outputBuffer;
      }
    } else {
      if (this._outputBuffer !== this.stretch.outputBuffer) {
        this.transposer.inputBuffer = this._inputBuffer;
        this.transposer.outputBuffer = this._intermediateBuffer;
        this.stretch.inputBuffer = this._intermediateBuffer;
        this.stretch.outputBuffer = this._outputBuffer;
      }
    }
  }
  process() {
    if (this._rate > 1) {
      this.stretch.process();
      this.transposer.process();
    } else {
      this.transposer.process();
      this.stretch.process();
    }
  }
}
const PROCESSOR_NAME = "soundtouch-processor";
class SoundTouchProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "pitch",
        defaultValue: 1,
        minValue: 0.25,
        maxValue: 4,
        automationRate: "k-rate"
      },
      {
        name: "tempo",
        defaultValue: 1,
        minValue: 0.25,
        maxValue: 4,
        automationRate: "k-rate"
      },
      {
        name: "rate",
        defaultValue: 1,
        minValue: 0.25,
        maxValue: 4,
        automationRate: "k-rate"
      },
      {
        name: "pitchSemitones",
        defaultValue: 0,
        minValue: -24,
        maxValue: 24,
        automationRate: "k-rate"
      },
      {
        name: "playbackRate",
        defaultValue: 1,
        minValue: 0.25,
        maxValue: 4,
        automationRate: "k-rate"
      }
    ];
  }
  _pipe;
  _samples;
  _outputSamples;
  constructor() {
    super();
    this._pipe = new SoundTouch();
    this._samples = new Float32Array(128 * 2);
    this._outputSamples = new Float32Array(128 * 2);
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input.length || !output[0] || !output[0].length) {
      return true;
    }
    const leftInput = input[0];
    const rightInput = input.length > 1 ? input[1] : input[0];
    const leftOutput = output[0];
    const rightOutput = output.length > 1 ? output[1] : output[0];
    const frameCount = leftInput.length;
    if (this._samples.length < frameCount * 2) {
      this._samples = new Float32Array(frameCount * 2);
      this._outputSamples = new Float32Array(frameCount * 2);
    }
    const rate = parameters["rate"][0];
    const tempo = parameters["tempo"][0];
    const pitch = parameters["pitch"][0];
    const pitchSemitones = parameters["pitchSemitones"][0];
    const playbackRate = parameters["playbackRate"][0];
    this._pipe.rate = rate;
    this._pipe.tempo = tempo;
    this._pipe.pitch = pitch * Math.pow(2, pitchSemitones / 12) / playbackRate;
    const samples = this._samples;
    for (let i = 0; i < frameCount; i++) {
      samples[i * 2] = leftInput[i];
      samples[i * 2 + 1] = rightInput[i];
    }
    this._pipe.inputBuffer.putSamples(samples, 0, frameCount);
    this._pipe.process();
    const outputBuffer = this._pipe.outputBuffer;
    const available = outputBuffer.frameCount;
    const toExtract = Math.min(available, frameCount);
    if (toExtract > 0) {
      const extracted = this._outputSamples;
      outputBuffer.receiveSamples(extracted, toExtract);
      for (let i = 0; i < toExtract; i++) {
        const l = extracted[i * 2];
        const r = extracted[i * 2 + 1];
        leftOutput[i] = Number.isFinite(l) ? l : 0;
        rightOutput[i] = Number.isFinite(r) ? r : 0;
      }
    }
    for (let i = toExtract; i < frameCount; i++) {
      leftOutput[i] = 0;
      rightOutput[i] = 0;
    }
    return true;
  }
}
registerProcessor(PROCESSOR_NAME, SoundTouchProcessor);
//# sourceMappingURL=soundtouch-processor.js.map
