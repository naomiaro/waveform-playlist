var playlist = new WaveformPlaylist.init({
  samplesPerPixel: 3000,
  mono: true,
  waveHeight: 70,
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
  },
  zoomLevels: [500, 1000, 3000, 5000]
});

playlist.load([
  {
    "src": "/media/audio/Vocals30.mp3",
    "name": "Vocals",
    "fadeIn": {
      "duration": 0.5
    },
    "fadeOut": {
      "duration": 0.5
    },
    "cuein": 5.918,
    "cueout": 14.5,
    "peaks": {
      type: "WebAudio",
      mono: false
    }
  },
  {
    "src": "/media/audio/BassDrums30.mp3",
    "name": "Drums",
    "start": 8.5,
    "fadeIn": {
      "shape": "logarithmic",
      "duration": 0.5
    },
    "fadeOut": {
      "shape": "logarithmic",
      "duration": 0.5
    },
    "peaks": {
      type: "WebAudio",
      mono: false
    }
  }
  ,
  {
    "src": "/media/audio/Guitar30.mp3",
    "name": "Guitar",
    "start": 23.5,
    "fadeOut": {
      "shape": "linear",
      "duration": 0.5
    },
    "cuein": 15,
    "peaks": {
      type: "WebAudio",
      mono: false
    }
  }
]).then(function() {
  //can do stuff with the playlist.
});