'use strict';

WaveformPlaylist.states = WaveformPlaylist.states || {};

/*
  called with an instance of Track as 'this'
*/

WaveformPlaylist.states.record = {

    classes: {
        container: "state-record"
    },

    enter: function() {
        var state = this.currentState;

        this.mediaRecorder = new MediaRecorder(userMediaStream);
        this.chunks = [];

        this.mediaRecorder.ondataavailable = function(e) {
          this.chunks.push(e.data);
          console.log("data available");

          var blob = new Blob(this.chunks, {'type': 'audio/ogg; codecs=opus'});
          state.draw.call(this, blob);

        }.bind(this);

        this.mediaRecorder.onstop = function(e) {
          console.log("stop recording");

          var blob = new Blob(this.chunks, {'type': 'audio/ogg; codecs=opus'});

          //change this call for streaming drawing.
          this.loadBlob(blob);

          this.chunks = undefined;
          this.mediaRecorder = undefined;
        }.bind(this);

        this.container.classList.add(state.classes.container);
        this.mediaRecorder.start(300);
    },

    leave: function() {
        var state = this.currentState;

        this.mediaRecorder.stop();
        this.container.classList.remove(state.classes.container);
    },

    draw: function(blob) {
      var fr = new FileReader();
      var that = this;
      fr.readAsArrayBuffer(blob);

      fr.addEventListener('load', function(e) {
        var ac = that.config.getAudioContext();

        ac.decodeAudioData(e.target.response || e.target.result,
          function(buffer) {
            // var peakInfo = that.drawer.getPeaks(buffer);
            // that.drawer.draw(peakInfo.peaks);
            that.drawer.drawWaveform(buffer);
          },
          function(err) { 
            console.log("err(decodeAudioData): "+err);
          });
      });
    }
};