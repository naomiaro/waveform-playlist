var playlist = WaveformPlaylist.init({
  samplesPerPixel: 9000,
  zoomLevels: [1000, 5000, 9000],
  waveHeight: 100,
  container: document.getElementById("playlist"),
  timescale: true,
  state: 'cursor',
  colors: {
    waveOutlineColor: '#005BBB',
    timeColor: 'grey',
    fadeColor: 'black'
  },
  controls: {
    show: true, //whether or not to include the track controls
    width: 250 //width of controls in pixels
  }
});

// Load empty playlist - ready for users to add tracks
playlist.load([]);