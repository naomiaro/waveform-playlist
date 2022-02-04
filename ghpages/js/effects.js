var playlist;

playlist = WaveformPlaylist.init({
  ac: Tone.getContext().rawContext,
  barWidth: 3,
  barGap: 1,
  container: document.getElementById("playlist"),
  colors: {
      waveOutlineColor: "#E0EFF1",
  },
  controls: {
    show: true,
    width: 200
  },
  zoomLevels: [500, 1000, 3000, 5000],
  samplesPerPixel: 1000,
  waveHeight: 100,
  isAutomaticScroll: true,
  timescale: true,
  state: "cursor",
  effects: function(masterGainNode, destination) {
    masterGainNode.connect(destination);
  }
});
  
playlist
  .load([
    {
      src: "media/audio/Vocals30.mp3",
      name: "Vocals",
      effects: function(graphEnd, masterGainNode) {
        var pitchShift = new Tone.PitchShift(12);

        Tone.connect(graphEnd, pitchShift);
        Tone.connect(pitchShift, masterGainNode);
      }
    },
    {
      src: "media/audio/Guitar30.mp3",
      name: "Guitar",
      effects: function(graphEnd, masterGainNode) {
        var reverb = new Tone.Reverb(5);

        Tone.connect(graphEnd, reverb);
        Tone.connect(reverb, masterGainNode);
      }
    },
    {
      src: "media/audio/PianoSynth30.mp3",
      name: "Pianos & Synth",
    },
    {
      src: "media/audio/BassDrums30.mp3",
      name: "Drums",
    },
  ])
  .then(function () {
    //can do stuff with the playlist.
  });
