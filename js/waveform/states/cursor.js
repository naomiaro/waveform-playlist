'use strict';

WaveformPlaylist.states = WaveformPlaylist.states || {};

/*
  called with an instance of Track as 'this'
*/

WaveformPlaylist.states.cursor = {

    classes: "state-cursor",

    enter: function() {
        var stateObject = this.currentState;

        this.container.onmousedown = stateObject.event.bind(this);
        this.container.classList.add(stateObject.classes);
    },

    leave: function() {
        var stateObject = this.currentState;

        this.container.onmousedown = null;
        this.container.classList.remove(stateObject.classes);
    },

    /*
     This is used when in 'cursor' state as a mousedown event
    */
    event: function(e) {
        e.preventDefault();

        var startX = e.layerX || e.offsetX, //relative to e.target (want the canvas).
            layerOffset,
            startTime;

        layerOffset = this.drawer.findLayerOffset(e.target);
        startX += layerOffset;
        startTime = this.pixelsToSeconds(startX);
        this.notifySelectUpdate(startTime, startTime);
  }
};