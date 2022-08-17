var userMediaStream;
var playlist;
var constraints = { audio: true };

navigator.getUserMedia = (navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia ||
  navigator.msGetUserMedia);

function gotStream(stream) {
  userMediaStream = stream;
  playlist.initRecorder(userMediaStream);
  $(".btn-record").removeClass("disabled");
}

function logError(err) {
  console.error(err);
}

playlist = WaveformPlaylist.init({
  samplesPerPixel: 3000,
  waveHeight: 100,
  container: document.getElementById("playlist"),
  state: 'cursor',
  colors: {
    waveOutlineColor: '#005BBB',
    timeColor: 'grey',
    fadeColor: 'black'
  },
  timescale: true,
  controls: {
    show: true, //whether or not to include the track controls
    width: 200 //width of controls in pixels
  },
  seekStyle : 'line',
  zoomLevels: [500, 1000, 3000, 5000]
});

playlist.load([
  {
    "src": "media/audio/Vocals30.mp3",
    "name": "Vocals",
    "fadeIn": {
      "duration": 0.5
    },
    "fadeOut": {
      "duration": 0.5
    },
    "cuein": 5.918,
    "cueout": 14.5,
    "customClass": "vocals",
    "waveOutlineColor": '#c0dce0'
  },
  {
    "src": "media/audio/BassDrums30.mp3",
    "name": "Drums",
    "start": 8.5,
    "fadeIn": {
      "shape": "logarithmic",
      "duration": 0.5
    },
    "fadeOut": {
      "shape": "logarithmic",
      "duration": 0.5
    }
  },
  {
    "src": "media/audio/Guitar30.mp3",
    "name": "Guitar",
    "start": 23.5,
    "fadeOut": {
      "shape": "linear",
      "duration": 0.5
    },
    "cuein": 15
  }
]).then(function() {
  //can do stuff with the playlist.

  //initialize the WAV exporter.
  playlist.initExporter();

  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia(constraints)
    .then(gotStream)
    .catch(logError);
  } else if (navigator.getUserMedia && 'MediaRecorder' in window) {
    navigator.getUserMedia(
      constraints,
      gotStream,
      logError
    );
  }
});