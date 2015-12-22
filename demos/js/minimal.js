(function(){

    var playlist = new WaveformPlaylist.init({
      samplesPerPixel: 2000,
      waveHeight: 100,
      container: document.getElementById("playlist"),
      colors: {
          waveOutlineColor: '#E0EFF1'
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

    playlist.load([
      {
        "src": "/media/audio/BassDrums30.mp3",
        "name": "Drums"
      }
    ]).then(function() {
      //can do stuff with the playlist.
    });

 })();