var playlist = new WaveformPlaylist.init({
  samplesPerPixel: 3000,
  mono: true,
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
    "name": "Vocals",
    "states": {
      "shift": false
    },
    "fadeIn": {
      "end": 0.5
    },
    "fadeOut": {
      "start": 29.5
    }
  },
  {
    "src": "/media/audio/BassDrums30.mp3",
    "name": "Drums",
    "start": 30,
    "fadeIn": {
      "shape": "logarithmic",
      "end": 0.50
    },
    "fadeOut": {
      "shape": "logarithmic",
      "start": 29.5
    }
  }
  ,
  {
    "src": "/media/audio/Guitar30.mp3",
    "name": "Guitar",
    "start": 45,
    "fadeIn": {
      "shape": "linear",
      "end": 0.50
    },
    "fadeOut": {
      "shape": "linear",
      "start": 29.5
    }
  }
]).then(function() {
  //can do stuff with the playlist.
});