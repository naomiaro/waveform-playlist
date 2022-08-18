import { FADEIN, FADEOUT, createFadeIn, createFadeOut } from "fade-maker";

function noEffects(node1, node2) {
  node1.connect(node2);
}

export default class {
  constructor(ac, buffer, masterGain = ac.createGain()) {
    this.ac = ac;
    this.gain = 1;
    this.effectsGraph = noEffects;
    this.masterEffectsGraph = noEffects;
    this.buffer = buffer;
    this.masterGain = masterGain;
    this.destination = this.ac.destination;
  }

  applyFade(type, start, duration, shape = "logarithmic") {
    if (type === FADEIN) {
      createFadeIn(this.fadeGain.gain, shape, start, duration);
    } else if (type === FADEOUT) {
      createFadeOut(this.fadeGain.gain, shape, start, duration);
    } else {
      throw new Error("Unsupported fade type");
    }
  }

  applyFadeIn(start, duration, shape = "logarithmic") {
    this.applyFade(FADEIN, start, duration, shape);
  }

  applyFadeOut(start, duration, shape = "logarithmic") {
    this.applyFade(FADEOUT, start, duration, shape);
  }

  isPlaying() {
    return this.source !== undefined;
  }

  getDuration() {
    return this.buffer.duration;
  }

  setAudioContext(ac) {
    this.ac = ac;
    this.destination = this.ac.destination;
  }

  createStereoPanner() {
    if (this.ac.createStereoPanner) {
      return this.ac.createStereoPanner();
    }
    return this.ac.createPanner();
  }

  setUpSource() {
    this.source = this.ac.createBufferSource();
    this.source.buffer = this.buffer;

    let cleanupEffects;
    let cleanupMasterEffects;

    const sourcePromise = new Promise((resolve) => {
      // keep track of the buffer state.
      this.source.onended = () => {
        this.source.disconnect();
        this.fadeGain.disconnect();
        this.volumeGain.disconnect();
        this.shouldPlayGain.disconnect();
        this.panner.disconnect();
        // this.masterGain.disconnect();

        if (cleanupEffects) cleanupEffects();
        if (cleanupMasterEffects) cleanupMasterEffects();

        this.source = undefined;
        this.fadeGain = undefined;
        this.volumeGain = undefined;
        this.shouldPlayGain = undefined;
        this.panner = undefined;

        resolve();
      };
    });

    this.fadeGain = this.ac.createGain();
    // used for track volume slider
    this.volumeGain = this.ac.createGain();
    // used for solo/mute
    this.shouldPlayGain = this.ac.createGain();
    this.panner = this.createStereoPanner();

    this.source.connect(this.fadeGain);
    this.fadeGain.connect(this.volumeGain);
    this.volumeGain.connect(this.shouldPlayGain);
    this.shouldPlayGain.connect(this.panner);

    cleanupEffects = this.effectsGraph(
      this.panner,
      this.masterGain,
      this.ac instanceof (window.OfflineAudioContext || window.webkitOfflineAudioContext)
    );
    cleanupMasterEffects = this.masterEffectsGraph(
      this.masterGain,
      this.destination,
      this.ac instanceof (window.OfflineAudioContext || window.webkitOfflineAudioContext)
    );

    return sourcePromise;
  }

  setVolumeGainLevel(level) {
    if (this.volumeGain) {
      this.volumeGain.gain.value = level;
    }
  }

  setShouldPlay(bool) {
    if (this.shouldPlayGain) {
      this.shouldPlayGain.gain.value = bool ? 1 : 0;
    }
  }

  setMasterGainLevel(level) {
    if (this.masterGain) {
      this.masterGain.gain.value = level;
    }
  }

  setStereoPanValue(pan = 0) {
    if (this.panner) {
      if (this.panner.pan !== undefined) {
        this.panner.pan.value = pan;
      } else {
        this.panner.panningModel = "equalpower";
        this.panner.setPosition(pan, 0, 1 - Math.abs(pan));
      }
    }
  }

  setEffects(effectsGraph = noEffects) {
    this.effectsGraph = effectsGraph;
  }

  setMasterEffects(effectsGraph = noEffects) {
    this.masterEffectsGraph = effectsGraph;
  }

  /*
    source.start is picky when passing the end time.
    If rounding error causes a number to make the source think
    it is playing slightly more samples than it has it won't play at all.
    Unfortunately it doesn't seem to work if you just give it a start time.
  */
  play(when, start, duration) {
    this.source.start(when, start, duration);
  }

  stop(when = 0) {
    if (this.source) {
      this.source.stop(when);
    }
  }
}
