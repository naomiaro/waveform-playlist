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
  container: document.getElementById("playlist"),
  colors: {
      waveOutlineColor: "#E0EFF1",
  },
  barWidth: 3,
  barGap: 1,
});
  
playlist.load([
  {
    src: "media/audio/sonnet.mp3",
  }
]).then(function() {
  //can do stuff with the playlist.

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
