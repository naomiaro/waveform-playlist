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
    var startX = e.layerX || e.offsetX, //relative to e.target (want the canvas).
        layerOffset,
        FADETYPE = "FadeIn",
        shape = this.config.getFadeType();

    layerOffset = this.findLayerOffset(e);
    if (layerOffset < 0) {
        return;
    }
    startX = startX + layerOffset;

    this.setSelectedArea(undefined, startX);
    this.removeFadeType(FADETYPE);
    this.createFade(FADETYPE, shape);
  }
};