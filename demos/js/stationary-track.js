(function(){

    var playlist = new WaveformPlaylist.init({
      samplesPerPixel: 3000,
      mono: true,
      waveHeight: 100,
      container: document.getElementById("playlist"),
      state: 'cursor',
      waveOutlineColor: '#E0EFF1',
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

    var ee = playlist.getEventEmitter();

    document.querySelector(".btn-play").addEventListener("click", function() {
      ee.emit("play");
    });

    document.querySelector(".btn-pause").addEventListener("click", function() {
      ee.emit("pause");
    });

    document.querySelector(".btn-stop").addEventListener("click", function() {
      ee.emit("stop");
    });

    document.querySelector(".btn-rewind").addEventListener("click", function() {
      ee.emit("rewind");
    });

    document.querySelector(".btn-fast-forward").addEventListener("click", function() {
      ee.emit("fastforward");
    });

    playlist.load([
      {
        "src": "/media/audio/Vocals30.mp3",
        "name": "Vocals"
      },
      {
        "src": "/media/audio/BassDrums30.mp3",
        "name": "Drums",
        "start": 30
      }
    ]).then(function() {
      //can do stuff with the playlist.
    });

 })();