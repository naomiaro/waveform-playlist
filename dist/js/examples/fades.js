var playlist = WaveformPlaylist.init({
  samplesPerPixel: 5000,
  zoomLevels: [1000, 5000, 9000],
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
    "src": "media/audio/Vocals30.mp3",
    "name": "Vocals",
    "states": {
      "shift": false
    },
    "fadeIn": {
      "duration": 0.5
    },
    "fadeOut": {
      "duration": 0.5
    }
  },
  {
    "src": "media/audio/BassDrums30.mp3",
    "name": "Drums",
    "start": 30,
    "fadeIn": {
      "shape": "logarithmic",
      "duration": 0.75
    },
    "fadeOut": {
      "shape": "logarithmic",
      "duration": 1.5
    }
  }
]).then(function() {
  //can do stuff with the playlist.
});