import { FADEIN, FADEOUT, createFadeIn, createFadeOut } from 'fade-maker';

class WebAudioPlayoutSource {
  ac: AudioContext;
  cueIn: number;
  cueOut: number;
  offset: number;
  gain: number;
  buffer: AudioBuffer;
  destination: AudioDestinationNode;
  source: AudioBufferSourceNode | undefined;
  fadeGain: GainNode;
  // used for track volume slider
  volumeGain: GainNode;
  masterGain: GainNode;
  constructor(ac: AudioContext, buffer: AudioBuffer) {
    this.ac = ac;
    this.gain = 1;
    this.buffer = buffer;
    this.destination = this.ac.destination;
    this.cueIn = 0;
    this.cueOut = buffer.duration;
    this.offset = 0;
    this.fadeGain = this.ac.createGain();
    this.volumeGain = this.ac.createGain();
    this.masterGain = this.ac.createGain();
    this.fadeGain.connect(this.volumeGain);
    this.volumeGain.connect(this.masterGain);
    this.masterGain.connect(this.destination);
  }

  get duration() {
    return this.cueOut - this.cueIn + this.offset;
  }

  applyFade(
    type: string,
    start: number,
    duration: number,
    shape = 'logarithmic'
  ) {
    if (type === FADEIN) {
      createFadeIn(this.fadeGain.gain, shape, start, duration);
    } else if (type === FADEOUT) {
      createFadeOut(this.fadeGain.gain, shape, start, duration);
    } else {
      throw new Error('Unsupported fade type');
    }
  }

  applyFadeIn(start: number, duration: number, shape = 'logarithmic') {
    this.applyFade(FADEIN, start, duration, shape);
  }

  applyFadeOut(start: number, duration: number, shape = 'logarithmic') {
    this.applyFade(FADEOUT, start, duration, shape);
  }

  isPlaying() {
    return this.source !== undefined;
  }

  setUpSource(): Promise<void> {
    const source = this.ac.createBufferSource();
    this.source = source;
    this.source.buffer = this.buffer;

    // TODO expose this to allow for custom node graphs
    source.connect(this.fadeGain);

    const sourcePromise = new Promise<void>((resolve) => {
      source.onended = () => {
        source.disconnect();
        resolve();
      };
    });

    return sourcePromise;
  }

  setCues(cueIn?: number, cueOut?: number, offset = 0) {
    this.cueIn = cueIn || 0;
    this.cueOut = cueOut || this.buffer.duration;
    this.offset = offset;
  }

  setVolumeGainLevel(level: number) {
    this.volumeGain.gain.value = level;
  }

  setMasterGainLevel(level: number) {
    this.masterGain.gain.value = level;
  }

  /*
    source.start is picky when passing the end time.
    If rounding error causes a number to make the source think
    it is playing slightly more samples than it has it won't play at all.
    Unfortunately it doesn't seem to work if you just give it a start time.
  */
  play(when: number, start: number, duration: number) {
    if (this.source) {
      this.source.start(when, start, duration);
    }
  }

  stop(when = 0) {
    if (this.source) {
      this.source.stop(when);
    }
    this.fadeGain.gain.cancelScheduledValues(when);
  }
}

export { WebAudioPlayoutSource };
