var playlist;

playlist = WaveformPlaylist.init({
  container: document.getElementById("playlist"),
  colors: {
    waveOutlineColor: "#005BBB",
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
});
