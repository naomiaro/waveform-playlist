/*
  called with an instance of Track as 'this'
*/
var fadeinState = {

  classes: "state-fadein",

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
    var startX = e.layerX || e.offsetX, //relative to e.target
        layerOffset,
        FADETYPE = "FadeIn",
        shape = this.config.getFadeType(),
        trackStartPix = this.drawer.pixelOffset,
        trackEndPix = trackStartPix + this.drawer.width;

    layerOffset = this.drawer.findLayerOffset(e.target);
    startX += layerOffset;

    this.removeFadeType(FADETYPE);

    if (trackStartPix <= startX && trackEndPix >= startX) {
      this.createFade(FADETYPE, shape, 0, (startX - trackStartPix));
    }
  }
};