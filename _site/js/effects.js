var playlist;
var toneCtx = Tone.getContext();
var audioCtx = toneCtx.rawContext;
var analyser = audioCtx.createAnalyser();
var offlineSetup = [];

var userMediaStream;
var constraints = { audio: true };

navigator.getUserMedia = (navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia ||
  navigator.msGetUserMedia);

function gotStream(stream) {
  userMediaStream = stream;
  playlist.initRecorder(userMediaStream);
  $(".btn-record").removeClass("disabled");
}

function logError(err) {
  console.error(err);
}

playlist = WaveformPlaylist.init({
  ac: audioCtx,
  barWidth: 3,
  barGap: 1,
  container: document.getElementById("playlist"),
  colors: {
    waveOutlineColor: '#005BBB'
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
  effects: function(masterGainNode, destination, isOffline) {
    // analyser nodes don't work offline.
    if (!isOffline) masterGainNode.connect(analyser);
    masterGainNode.connect(destination);
  }
});

//initialize the WAV exporter.
playlist.initExporter();

playlist.ee.on("audiorenderingstarting", function(offlineCtx, setup) {
  // Set Tone offline to render effects properly.
  const offlineContext = new Tone.OfflineContext(offlineCtx);
  Tone.setContext(offlineContext);
  offlineSetup = setup;
});

playlist.ee.on("audiorenderingfinished", function() {
  //restore original ctx for further use.
  Tone.setContext(toneCtx);
});
  
playlist
  .load([
    {
      src: "media/audio/Vocals30.mp3",
      name: "Vocals",
      effects: function vocalsEffects(graphEnd, masterGainNode, isOffline) {
        var autoWah = new Tone.AutoWah(50, 6, -30);
      
        Tone.connect(graphEnd, autoWah);
        Tone.connect(autoWah, masterGainNode);
      
        return function cleanup() {
          autoWah.disconnect();
          autoWah.dispose();
        }
      }
    },
    {
      src: "media/audio/Guitar30.mp3",
      name: "Guitar",
      effects: function(graphEnd, masterGainNode, isOffline) {
        var reverb = new Tone.Reverb(1.2);

        if (isOffline) {
          offlineSetup.push(reverb.ready);
        }

        Tone.connect(graphEnd, reverb);
        Tone.connect(reverb, masterGainNode);

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
      effects: function(graphEnd, masterGainNode, isOffline) {
        var reverb = new Tone.Reverb(5);

        if (isOffline) {
          offlineSetup.push(reverb.ready);
        }

        Tone.connect(graphEnd, reverb);
        Tone.connect(reverb, masterGainNode);

        return function cleanup() {
          reverb.disconnect();
          reverb.dispose();
        }
      }
    },
  ])
  .then(function () {
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
  // The following code is from Mozilla Developer Network:
  // This draws the frequency data to the canvas.
  analyser.fftSize = 256;
  var bufferLength = analyser.frequencyBinCount;
  var dataArray = new Uint8Array(bufferLength);
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
    analyser.getByteFrequencyData(dataArray);

    canvasCtx.fillStyle = 'rgb(255, 255, 255)';
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

    var barWidth = WIDTH / scale / bufferLength - 1;
    var barHeight;
    var x = 0;

    for(var i = 0; i < bufferLength; i++) {
      barHeight = dataArray[i]/2/scale;

      canvasCtx.fillStyle = 'rgb('+(barHeight+100)+',50,50)';
      canvasCtx.fillRect(x,HEIGHT/scale-barHeight/2,barWidth,barHeight);

      x += barWidth + 1;
    }
  }

  draw();
