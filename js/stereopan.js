var playlist = WaveformPlaylist.init({
  container: document.getElementById('playlist'),
  controls: {
    show: true, // whether or not to include the track controls
    width: 200, // width of controls in pixels
  },
  colors: {
    waveOutlineColor: '#005BBB'
  },
});

playlist
  .load([
    {
      name: 'Left Panned Track',
      src: 'media/audio/PianoSynth30.mp3',
      stereoPan: -1,
    },
    {
      name: 'Right Panned Track',
      src: 'media/audio/BassDrums30.mp3',
      stereoPan: 1,
    },
  ])
  .then(() => {
    // can do stuff with the playlist.
  });
