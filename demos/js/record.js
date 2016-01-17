var userMediaStream;
var playlist;

navigator.getUserMedia = (navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia ||
  navigator.msGetUserMedia);

if (navigator.getUserMedia && 'MediaRecorder' in window) {
  navigator.getUserMedia(
    {
      audio: true
    },
    function(stream) {
      userMediaStream = stream;
      playlist.initRecorder(userMediaStream);
      $(".btn-record").removeClass("disabled");
    },
    function(err) {
      console.error(err);
    }
  );
}

playlist = new WaveformPlaylist.init({
  samplesPerPixel: 9000,
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