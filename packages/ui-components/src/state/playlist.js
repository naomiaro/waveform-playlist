import { types, onSnapshot, getEnv } from 'mobx-state-tree';

const Track = types
  .model('Track', {
    title: types.string,
    pan: 0,
    gain: 1,
    muted: false,
    fadeIn: 0,
    fadeOut: 0,
    fadeInType: 'linear',
    fadeOutType: 'linear',
  })
  .actions((self) => ({
    play(when = 0) {
      // inject Tone.js etc
      getEnv(self).playout.play(when);
    },
    stop(when = 0) {
      // inject Tone.js etc
      getEnv(self).playout.stop(when);
    },
  }));

const Playlist = types.model('Playlist', {
  tracks: types.array(Track),
  sampleRate: 48000,
  samplesPerPixel: 1000,
  zoomLevels: [1000, 1500, 2000, 2500],
  waveHeight: 80,
  timeScaleHeight: 15,
  controls: {
    show: false,
    width: 150,
  },
  duration: 30000,
});
