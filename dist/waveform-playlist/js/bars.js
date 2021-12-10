var playlist = WaveformPlaylist.init({
  container: document.getElementById("playlist")
});

playlist.load([
  {
    "src": "media/audio/sonnet.mp3",
    barWidth: 3,
    barGap: 3,
  }
]).then(function() {
  //can do stuff with the playlist.
});
