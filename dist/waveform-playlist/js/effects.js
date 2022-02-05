var playlist;
var audioCtx = Tone.getContext().rawContext;
var analyser = audioCtx.createAnalyser();

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
    masterGainNode.connect(analyser);
    masterGainNode.connect(destination);
  }
});
  
playlist
  .load([
    {
      src: "media/audio/Vocals30.mp3",
      name: "Vocals",
      effects: function(graphEnd, masterGainNode) {
        var autoWah = new Tone.AutoWah(50, 6, -30);

        Tone.connect(graphEnd, autoWah);
        Tone.connect(autoWah, masterGainNode);
      }
    },
    {
      src: "media/audio/Guitar30.mp3",
      name: "Guitar",
      effects: function(graphEnd, masterGainNode) {
        var reverb = new Tone.Reverb(1.2);

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
