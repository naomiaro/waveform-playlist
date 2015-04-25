/*
  called with an instance of Track as 'this'
*/

var selectState = {

  classes: "state-select",

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
      This is used when in 'select' state as a mousedown event
  */
  event: function(e) {
      e.preventDefault();

      var el = this.container, //want the events placed on the channel wrapper.
          editor = this,
          startX = e.layerX || e.offsetX, //relative to e.target (want the canvas).
          prevX = e.layerX || e.offsetX,
          offset = this.leftOffset,
          startTime,
          layerOffset,
          complete;

      layerOffset = this.findLayerOffset(e);
      if (layerOffset < 0) {
          return;
      }
      startX = startX + layerOffset;
      prevX = prevX + layerOffset;

      editor.setSelectedArea(startX, startX);
      startTime = editor.samplesToSeconds(offset + editor.selectedArea.start);

      editor.notifySelectUpdate(startTime, startTime);

      //dynamically put an event on the element.
      el.onmousemove = function(e) {
          e.preventDefault();

          var currentX = layerOffset + (e.layerX || e.offsetX),
              delta = currentX - prevX,
              minX = Math.min(prevX, currentX, startX),
              maxX = Math.max(prevX, currentX, startX),
              selectStart,
              selectEnd,
              startTime, endTime;
          
          if (currentX > startX) {
              selectStart = startX;
              selectEnd = currentX;
          }
          else {
              selectStart = currentX;
              selectEnd = startX;
          }

          startTime = editor.samplesToSeconds(offset + editor.selectedArea.start);
          endTime = editor.samplesToSeconds(offset + editor.selectedArea.end);

          editor.setSelectedArea(selectStart, selectEnd);
          editor.notifySelectUpdate(startTime, endTime);
          prevX = currentX;
      };

      complete = function(e) {
          e.preventDefault();

          var endX = layerOffset + (e.layerX || e.offsetX),
              minX, maxX,
              startTime, endTime;

          minX = Math.min(startX, endX);
          maxX = Math.max(startX, endX);

          editor.setSelectedArea(minX, maxX, e.shiftKey);

          minX = editor.samplesToPixels(offset + editor.selectedArea.start);
          maxX = editor.samplesToPixels(offset + editor.selectedArea.end);

          el.onmousemove = el.onmouseup = el.onmouseleave = null;
          
          //if more than one pixel is selected, listen to possible fade events.
          if (Math.abs(minX - maxX)) {
              editor.activateAudioSelection();
          }
          else {
              editor.deactivateAudioSelection();
          }

          startTime = editor.samplesToSeconds(offset + editor.selectedArea.start);
          endTime = editor.samplesToSeconds(offset + editor.selectedArea.end);

          editor.config.setCursorPos(startTime);
          editor.notifySelectUpdate(startTime, endTime);    
      };

      el.onmouseup = el.onmouseleave = complete;
  }
};