/*
  called with an instance of Track as 'this'
*/

var cursorState = {

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
      var editor = this,
          startX = e.layerX || e.offsetX, //relative to e.target (want the canvas).
          offset = this.leftOffset,
          startTime, 
          endTime,
          layerOffset;

      layerOffset = this.findLayerOffset(e);
      if (layerOffset < 0) {
          return;
      }
      startX = startX + layerOffset;

      editor.setSelectedArea(startX, startX);
      startTime = editor.samplesToSeconds(offset + editor.selectedArea.start);
      endTime = editor.samplesToSeconds(offset + editor.selectedArea.end);

      editor.config.setCursorPos(startTime);
      editor.notifySelectUpdate(startTime, endTime);

      editor.deactivateAudioSelection();
  }
};