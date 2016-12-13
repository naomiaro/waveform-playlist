var playlist = WaveformPlaylist.init({
  samplesPerPixel: 9000,
  zoomLevels: [1000, 5000, 9000],
  waveHeight: 100,
  container: document.getElementById("playlist"),
  timescale: true,
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

//initialize the WAV exporter.
playlist.initExporter();