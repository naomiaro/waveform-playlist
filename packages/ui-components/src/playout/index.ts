import { load } from '../loading';
import { WebAudioPlayoutSource } from './WebAudioPlayoutSource';

type FadeCurve = 'logarithmic' | 'linear' | 'sCurve' | 'exponential';
type FadeDefinition = {
  shape?: FadeCurve;
  // length of fade from beginning or end of the track, in seconds.
  duration: number;
};
type AudioSource = string | File;

export interface ISourceSchedule {
  when: number;
  start: number;
  duration: number;
  fadeIn?: {
    start: number;
    duration: number;
    shape?: FadeCurve;
  };
  fadeOut?: {
    start: number;
    duration: number;
    shape?: FadeCurve;
  };
}

export interface ITrackConfig {
  // volume level of the track between [0-1]
  gain?: number;
  // time in seconds relative to the playlist
  // ex (track will start after 8.5 seconds)
  // can be negative.
  // DEFAULT 0 - track starts at beginning of playlist
  start?: number;
  // track fade in details
  fadeIn?: FadeDefinition;
  // track fade out details
  fadeOut?: FadeDefinition;
  // where the waveform for this track should begin from
  // ex (Waveform will begin 15 seconds into this track)
  // DEFAULT start at the beginning - 0 seconds
  cueIn?: number;
  // where the waveform for this track should end
  // ex (Waveform will end at 30 second into this track)
  // DEFAULT duration of the track
  cueOut?: number;
}

// reference api https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement

export function clampGain(gain: number) {
  if (gain > 1) {
    return 1;
  } else if (gain < 0) {
    return 0;
  }

  return gain;
}

export function scheduleSourcePlayout(
  cueIn: number,
  cueOut: number,
  offset: number,
  config: ITrackConfig,
  now: number,
  start: number = 0,
  duration?: number
): ISourceSchedule {
  const fadeIn = config.fadeIn;
  const fadeOut = config.fadeOut;

  const clipped = start - offset;
  const trackLength = cueOut - cueIn;
  let playLength;
  let schedule: ISourceSchedule = {
    when: 0,
    start: 0,
    duration: 0,
  };

  if (typeof duration === 'number') {
    //starting at or after the cuein
    if (clipped > 0) {
      playLength = Math.min(duration, trackLength - clipped);
    } else {
      // some duration is eaten by the silence of the offset.
      playLength = Math.min(duration + clipped, trackLength);
    }
  } else {
    if (clipped < 0) {
      playLength = trackLength;
    } else {
      playLength = trackLength - clipped;
    }
  }
  if (playLength <= 0) {
    return schedule;
  }

  const when = now + Math.abs(Math.min(0, clipped));
  const trackStart = clipped < 0 ? cueIn : cueIn + clipped;

  schedule = Object.assign(schedule, {
    when,
    start: trackStart,
    duration: playLength,
  });

  if (fadeIn) {
    const start = now - clipped;
    if (start >= 0) {
      schedule = Object.assign(schedule, {
        fadeIn: {
          start,
          duration: fadeIn.duration,
          shape: fadeIn.shape,
        },
      });
    }
  }

  if (fadeOut) {
    const start = now - clipped + trackLength - fadeOut.duration;
    if (start >= 0) {
      schedule = Object.assign(schedule, {
        fadeOut: {
          start,
          duration: fadeOut.duration,
          shape: fadeOut.shape,
        },
      });
    }
  }

  return schedule;
}

class Playout {
  ac: AudioContext;
  tracks: AudioSource[];
  trackConfigs: ITrackConfig[];
  buffers: AudioBuffer[];
  sources: WebAudioPlayoutSource[];
  masterGain: number;
  constructor(
    tracks: AudioSource[],
    trackConfigs?: ITrackConfig[],
    ac?: AudioContext
  ) {
    this.ac = ac || new AudioContext();
    this.tracks = tracks;
    this.trackConfigs = trackConfigs || Array(tracks.length).fill({});
    this.buffers = [];
    this.sources = [];
    this.masterGain = 1;
  }
  async load() {
    this.buffers = await Promise.all(
      this.tracks.map((track) => load(track, this.ac))
    );
    this.sources = this.buffers.map(
      (buffer) => new WebAudioPlayoutSource(this.ac, buffer)
    );
    this.configure(this.trackConfigs);
  }

  get duration() {
    let duration = 0;
    for (let i = 0; i < this.sources.length; i++) {
      duration = Math.max(duration, this.sources[i].duration);
    }

    return duration;
  }

  configure(configs: ITrackConfig[]) {
    configs.forEach((config, i) => {
      const track = this.sources[i];
      track.setCues(config.cueIn, config.cueOut, config.start);
    });
    this.trackConfigs = configs;
  }

  setMasterGain(gain: number) {
    this.masterGain = clampGain(gain);
  }

  createSources() {
    return this.sources.map((source, i) => {
      const playBackPromise = source.setUpSource();
      const gain =
        typeof this.trackConfigs[i].gain === 'number'
          ? clampGain(this.trackConfigs[i].gain as number)
          : 1;

      source.setVolumeGainLevel(gain);
      source.setMasterGainLevel(this.masterGain);

      return playBackPromise;
    });
  }

  /*
   * @param start - time in seconds relative to playlist to start playing.
   * @param duration - time in seconds to continue playout.
   */
  play(start: number = 0, duration?: number) {
    const playBackPromises = this.createSources();
    const now = this.ac.currentTime;

    this.sources.forEach((source, i) => {
      const cueIn = source.cueIn;
      const cueOut = source.cueOut;
      const offset = source.offset;
      const schedule = scheduleSourcePlayout(
        cueIn,
        cueOut,
        offset,
        this.trackConfigs[i],
        now,
        start,
        duration
      );

      if (schedule.fadeIn) {
        const fadeIn = schedule.fadeIn;
        source.applyFadeIn(fadeIn.start, fadeIn.duration, fadeIn.shape);
      }

      if (schedule.fadeOut) {
        const fadeOut = schedule.fadeOut;
        source.applyFadeOut(fadeOut.start, fadeOut.duration, fadeOut.shape);
      }

      source.play(schedule.when, schedule.start, schedule.duration);
    });

    return playBackPromises;
  }

  stop() {
    this.sources.forEach((source) => source.stop());
  }
}

export { Playout };
