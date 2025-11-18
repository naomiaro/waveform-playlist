var playlist = WaveformPlaylist.init({
  samplesPerPixel: 1000,
  waveHeight: 100,
  container: document.getElementById("playlist"),
  colors: {
    waveOutlineColor: "#005BBB",
    waveFillColor: "#f0f0f0",
    waveProgressColor: "#ff0000",
  },
});

playlist
  .load([
    {
      src: "media/audio/Vocals30.mp3",
      name: "Vocals",
    },
    {
      src: "media/audio/Guitar30.mp3",
      name: "Guitar",
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
    console.log("Stem tracks loaded with new React architecture!");
    console.log("Using Tone.js 15.1.22 for multitrack playback");
    console.log("Loaded tracks:", playlist.getTracks());

    // Wire up playback controls
    var ee = playlist.getEventEmitter();

    document.querySelector(".btn-play").addEventListener("click", function () {
      ee.emit("play");
    });

    document.querySelector(".btn-pause").addEventListener("click", function () {
      ee.emit("pause");
    });

    document.querySelector(".btn-stop").addEventListener("click", function () {
      ee.emit("stop");
    });

    // Wire up master gain slider
    var masterGainSlider = document.getElementById("master-gain");
    if (masterGainSlider) {
      masterGainSlider.addEventListener("input", function (e) {
        var gain = parseFloat(e.target.value) / 100;
        playlist.setMasterGain(gain);
        console.log("Master gain set to:", gain);
      });

      // Set initial value
      playlist.setMasterGain(1.0);
    }

    // Display current time during playback
    var timeDisplay = document.getElementById("time-display");
    if (timeDisplay) {
      setInterval(function () {
        var currentTime = playlist.getCurrentTime();
        timeDisplay.textContent = currentTime.toFixed(2) + "s";
      }, 100);
    }
  });
