var playlist = WaveformPlaylist.init({
  container: document.getElementById("playlist"),
  waveHeight: 80,
  mono: false,
  timescale: true,
  state: 'cursor',
  colors: {
    waveOutlineColor: '#E0EFF1'
  },
  controls: {
    show: true, //whether or not to include the track controls
    width: 200 //width of controls in pixels
  },
});

playlist.load([
  {
    src: "media/audio/BassDrums30.mp3",
    name: "Bass & Drums"
  }
]).then(function() {
  //can do stuff with the playlist.
});
