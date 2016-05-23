var playlist = WaveformPlaylist.init({
  waveHeight: 100,
  container: document.getElementById("playlist"),
  colors: {
      waveOutlineColor: '#E0EFF1'
  },
  timescale: true
});

playlist.load([
  {
    src: "media/audio/BassDrums30.mp3",
    selected: {
      start: 5,
      end: 15
    },
    states: {
      cursor: false,
      select: false,
      shift: false,
      fadein: false,
      fadeout: false
    }
  }
]).then(function() {
  //can do stuff with the playlist.
});
