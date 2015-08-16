'use strict';

WaveformPlaylist.states = WaveformPlaylist.states || {};

/*
  called with an instance of Track as 'this'
*/

WaveformPlaylist.states.cursor = {

    classes: "state-cursor",

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
     This is used when in 'cursor' state as a mousedown event
    */
    event: function(e) {
        e.preventDefault();

        var startX,
            startTime;

        startX = this.drawer.findClickedPixel(e);
        startTime = this.pixelsToSeconds(startX);
        this.notifySelectUpdate(startTime, startTime);
  }
};