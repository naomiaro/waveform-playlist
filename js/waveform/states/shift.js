'use strict';

WaveformPlaylist.states = WaveformPlaylist.states || {};

/*
  called with an instance of Track as 'this'
*/
WaveformPlaylist.states.shift = {

  classes: "state-shift",

  enter: function() {
    var stateObject = this.currentState;

    this.drawer.waveformContainer.onmousedown = stateObject.event.bind(this);
    this.container.classList.add(stateObject.classes);
  },

  leave: function() {
    var stateObject = this.currentState;

    this.drawer.waveformContainer.onmousedown = null;
    this.container.classList.remove(stateObject.classes);
  },

  /*
      mousedown event in 'shift' mode
  */
  event: function(e) {
      e.preventDefault();

      var el = this.drawer.waveformContainer, //want the events placed on the waveform wrapper.
          editor = this,
          startX = e.pageX, 
          diffX = 0, 
          updatedX = 0,
          origX = editor.leftOffset / editor.resolution,
          complete;

      //dynamically put an event on the element.
      el.onmousemove = function(e) {
          e.preventDefault();

          var endX = e.pageX;
          
          diffX = endX - startX;
          updatedX = origX + diffX;
          editor.setLeftOffset(editor.pixelsToSamples(updatedX));
      };

      complete = function(e) {
          e.preventDefault();

          var delta = editor.pixelsToSeconds(diffX);

          el.onmousemove = el.onmouseup = el.onmouseleave = null;

          //update track's start and end time relative to the playlist.
          //TODO this should probably be done in the mousemove event.
          editor.startTime = editor.startTime + delta;
          editor.endTime = editor.endTime + delta;

          editor.setLeftOffset(editor.pixelsToSamples(updatedX));
      };

      el.onmouseup = el.onmouseleave = complete;
  }
};