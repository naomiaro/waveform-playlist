// Initialize the playlist with the new React-based API
var playlist = WaveformPlaylist.init({
  container: document.getElementById("playlist"),
  colors: {
    waveOutlineColor: '#005BBB'
  },
  controls: {
    show: false
  },
});

// Load tracks
playlist.load([
  {
    "src": "media/audio/BassDrums30.mp3"
  }
]).then(function() {
  console.log('Playlist loaded with new React architecture!');
  console.log('Using Tone.js 15.1.22 for playback');
}).catch(function(error) {
  console.error('Failed to load playlist:', error);
});
