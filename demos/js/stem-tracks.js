var playlist = new WaveformPlaylist.init({
  samplesPerPixel: 1000,
  waveHeight: 100,
  container: document.getElementById("playlist"),
  state: 'cursor',
  colors: {
    waveOutlineColor: '#E0EFF1',
    timeColor: 'grey',
    fadeColor: 'black'
  },
  controls: {
    show: true, //whether or not to include the track controls
    width: 200 //width of controls in pixels
  }
});

playlist.load([
  {
    "src": "/media/audio/Vocals30.mp3",
    "name": "Vocals"
  },
  {
    "src": "/media/audio/Guitar30.mp3",
    "name": "Guitar"
  },
  {
    "src": "/media/audio/PianoSynth30.mp3",
    "name": "Pianos & Synth"
  },
  {
    "src": "/media/audio/BassDrums30.mp3",
    "name": "Drums"
  }
]).then(function() {
  //can do stuff with the playlist.
});
