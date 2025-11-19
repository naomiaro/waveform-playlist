var playlist = WaveformPlaylist.init({
  samplesPerPixel: 1000,
  waveHeight: 100,
  container: document.getElementById("playlist"),
  colors: {
    waveOutlineColor: "#005BBB",
    waveFillColor: "#FFD500",
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

    // Note: Playback controls are handled by emitter.js

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
    var timeDisplay = document.querySelector(".audio-pos");
    var timeUpdateInterval = null;
    var isPlaying = false;

    if (timeDisplay) {
      // Helper function to format time as hh:mm:ss.uuu
      function formatTime(seconds) {
        var hours = Math.floor(seconds / 3600) % 24;
        var minutes = Math.floor(seconds / 60) % 60;
        var secs = (seconds % 60).toFixed(3);

        return (hours < 10 ? "0" + hours : hours) + ":" +
               (minutes < 10 ? "0" + minutes : minutes) + ":" +
               (secs < 10 ? "0" + secs : secs);
      }

      function updateTimeDisplay() {
        var currentTime = playlist.getCurrentTime();
        timeDisplay.textContent = formatTime(currentTime);
      }

      function startTimeUpdates() {
        if (!timeUpdateInterval) {
          timeUpdateInterval = setInterval(updateTimeDisplay, 100);
        }
      }

      function stopTimeUpdates() {
        if (timeUpdateInterval) {
          clearInterval(timeUpdateInterval);
          timeUpdateInterval = null;
        }
      }

      // Listen to play/pause/stop events via the event emitter
      var ee = playlist.getEventEmitter();

      ee.on("play", function() {
        isPlaying = true;
        startTimeUpdates();
      });

      ee.on("pause", function() {
        isPlaying = false;
        stopTimeUpdates();
        updateTimeDisplay(); // Update once more to show final position
      });

      ee.on("stop", function() {
        isPlaying = false;
        stopTimeUpdates();
        updateTimeDisplay(); // Update once more to show final position
      });

      // Initialize with current time
      updateTimeDisplay();
    }
  });
