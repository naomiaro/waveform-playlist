var playlist;
var analyser;
var offlineSetup = [];

var userMediaStream;
var constraints = { audio: true };

navigator.getUserMedia = (navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia ||
  navigator.msGetUserMedia);

function gotStream(stream) {
  userMediaStream = stream;
  // TODO: Recording not yet implemented in new version
  // playlist.initRecorder(userMediaStream);
  // $(".btn-record").removeClass("disabled");
}

function logError(err) {
  console.error(err);
}

playlist = WaveformPlaylist.init({
  // ac: audioCtx,  // Remove this - let Tone.js manage its own context
  // barWidth: 3,  // TODO: Bar rendering not supported in new version
  // barGap: 1,
  container: document.getElementById("playlist"),
  colors: {
    waveOutlineColor: '#005BBB',
    waveFillColor: '#FFD500'
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
  // state: "cursor",  // TODO: State parameter not yet implemented
  // Master effects to set up the analyser
  effects: function(masterGainNode, destination, isOffline, ToneLib) {
    // Create analyser and connect it in parallel to monitor the output
    analyser = new ToneLib.Analyser('fft', 256);
    masterGainNode.connect(analyser);

    // Connect master to destination as normal
    masterGainNode.connect(destination);

    return function cleanup() {
      // Cleanup when playlist is destroyed
      analyser.dispose();
    };
  }
});

// TODO: WAV exporter not yet implemented in new version
// playlist.initExporter();

// TODO: Event emitter not yet implemented in new version
// playlist.ee.on("audiorenderingstarting", function(offlineCtx, setup) {
//   // Set Tone offline to render effects properly.
//   const offlineContext = new Tone.OfflineContext(offlineCtx);
//   Tone.setContext(offlineContext);
//   offlineSetup = setup;
// });

// playlist.ee.on("audiorenderingfinished", function() {
//   //restore original ctx for further use.
//   Tone.setContext(toneCtx);
// });
  
playlist
  .load([
    {
      src: "media/audio/Vocals30.mp3",
      name: "Vocals",
      effects: function vocalsEffects(graphEnd, masterGainNode, isOffline, ToneLib) {
        var autoWah = new ToneLib.AutoWah({
          context: graphEnd.context,
          baseFrequency: 50,
          octaves: 6,
          sensitivity: -30
        });

        graphEnd.connect(autoWah);
        autoWah.connect(masterGainNode);

        return function cleanup() {
          autoWah.disconnect();
          autoWah.dispose();
        }
      }
    },
    {
      src: "media/audio/Guitar30.mp3",
      name: "Guitar",
      effects: function(graphEnd, masterGainNode, isOffline, ToneLib) {
        var reverb = new ToneLib.Reverb({
          context: graphEnd.context,
          decay: 1.2
        });

        if (isOffline) {
          offlineSetup.push(reverb.ready);
        }

        graphEnd.connect(reverb);
        reverb.connect(masterGainNode);

        return function cleanup() {
          reverb.disconnect();
          reverb.dispose();
        }
      }
    },
    {
      src: "media/audio/PianoSynth30.mp3",
      name: "Pianos & Synth",
    },
    {
      src: "media/audio/BassDrums30.mp3",
      name: "Drums",
      effects: function(graphEnd, masterGainNode, isOffline, ToneLib) {
        var reverb = new ToneLib.Reverb({
          context: graphEnd.context,
          decay: 5
        });

        if (isOffline) {
          offlineSetup.push(reverb.ready);
        }

        graphEnd.connect(reverb);
        reverb.connect(masterGainNode);

        return function cleanup() {
          reverb.disconnect();
          reverb.dispose();
        }
      }
    },
  ])
  .then(function () {
    console.log('Analyser connected');

    // Start visualization now that analyser is ready
    draw();

    // Hook up master volume slider
    var masterGainSlider = document.getElementById('master-gain');
    if (masterGainSlider) {
      masterGainSlider.addEventListener('input', function(e) {
        var value = parseFloat(e.target.value) / 100; // Convert 0-100 to 0-1
        playlist.setMasterGain(value);
      });
    }

    //can do stuff with the playlist.

    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia(constraints)
      .then(gotStream)
      .catch(logError);
    } else if (navigator.getUserMedia && 'MediaRecorder' in window) {
      navigator.getUserMedia(
        constraints,
        gotStream,
        logError
      );
    }
  });

  // https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API
  // The following code is adapted from Mozilla Developer Network:
  // This draws the frequency data to the canvas.
  var drawVisual;
  var canvas = document.querySelector('.visualizer');
  var canvasCtx = canvas.getContext("2d");
  var WIDTH = canvas.width;
  var HEIGHT = canvas.height;
  canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

  // added scale for retina
  var scale = Math.floor(window.devicePixelRatio);
  canvasCtx.scale(scale, scale);

  function draw() {
    drawVisual = requestAnimationFrame(draw);

    // Skip if analyser not ready yet
    if (!analyser) return;

    var dataArray = analyser.getValue(); // Returns Float32Array with dB values
    var bufferLength = dataArray.length;

    canvasCtx.fillStyle = 'rgb(255, 255, 255)';
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

    var barWidth = WIDTH / scale / bufferLength - 1;
    var barHeight;
    var x = 0;

    for(var i = 0; i < bufferLength; i++) {
      // Tone.Analyser FFT mode returns dB values (typically -100 to 0)
      // Normalize to 0-255 range
      var dbValue = dataArray[i];
      var normalized = Math.max(0, Math.min(255, (dbValue + 100) * 2.55));
      barHeight = normalized / 2 / scale;

      canvasCtx.fillStyle = 'rgb('+(barHeight+100)+',50,50)';
      canvasCtx.fillRect(x,HEIGHT/scale-barHeight/2,barWidth,barHeight);

      x += barWidth + 1;
    }
  }

  // draw() is now called after analyser is created in the .then() callback
