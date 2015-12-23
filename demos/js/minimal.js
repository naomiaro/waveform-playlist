var playlist = new WaveformPlaylist.init({
  samplesPerPixel: 2000,
  waveHeight: 100,
  container: document.getElementById("playlist"),
  colors: {
      waveOutlineColor: '#E0EFF1'
  }
});

playlist.load([
  {
    "src": "/media/audio/BassDrums30.mp3",
    "name": "Drums"
  }
]).then(function() {
  //can do stuff with the playlist.
});
