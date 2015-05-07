'use strict';

WaveformPlaylist.states = WaveformPlaylist.states || {};

/*
  called with an instance of Track as 'this'
*/
WaveformPlaylist.states.fadeout = {

  classes: "state-fadeout",

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

  event: function(e) {
    var startX = e.layerX || e.offsetX, //relative to e.target (want the canvas).
        layerOffset,
        FADETYPE = "FadeOut",
        shape = this.config.getFadeType(),
        trackStartPix = this.drawer.pixelOffset,
        trackEndPix = trackStartPix + this.drawer.width;

    layerOffset = this.drawer.findLayerOffset(e.target);
    startX += layerOffset;

    this.removeFadeType(FADETYPE);

    if (trackStartPix <= startX && trackEndPix >= startX) {
      this.createFade(FADETYPE, shape, (startX - trackStartPix), this.drawer.width);
    }
  }
};