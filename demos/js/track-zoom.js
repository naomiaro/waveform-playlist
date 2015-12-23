var playlist = new WaveformPlaylist.init({
  samplesPerPixel: 4096, //samples per pixel to draw, must be an entry in zoomLevels.
  waveHeight: 100,
  container: document.getElementById("playlist"),
  colors: {
      waveOutlineColor: '#E0EFF1'
  },
  zoomLevels: [512, 1024, 2048, 4096] //zoom levels in samples per pixel
});

playlist.load([
  {
    "src": "/media/audio/BassDrums30.mp3"
  }
]).then(function() {
  //can do stuff with the playlist.
});