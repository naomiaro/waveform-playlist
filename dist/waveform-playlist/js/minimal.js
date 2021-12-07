var playlist = WaveformPlaylist.init({
  waveHeight: 75,
  container: document.getElementById("playlist"),
});

playlist.load([
  {
    "src": "media/audio/BassDrums30.mp3",
    barWidth: 6,
    barGap: 4,
  }
]).then(function() {
  //can do stuff with the playlist.
});
