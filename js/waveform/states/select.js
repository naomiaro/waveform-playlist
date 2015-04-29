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
          startX = e.layerX || e.offsetX,
          startTime,
          layerOffset,
          complete;

      layerOffset = editor.drawer.findLayerOffset(e.target);
      startX += layerOffset;
      startTime = editor.pixelsToSeconds(startX);
      editor.notifySelectUpdate(startTime, startTime);

      //dynamically put an event on the element.
      el.onmousemove = function(e) {
          e.preventDefault();

          var layerOffset = editor.drawer.findLayerOffset(e.target),
              currentX = layerOffset + (e.layerX || e.offsetX),
              minX = Math.min(currentX, startX),
              maxX = Math.max(currentX, startX),
              startTime,
              endTime;

          startTime = editor.pixelsToSeconds(minX);
          endTime = editor.pixelsToSeconds(maxX);
          editor.notifySelectUpdate(startTime, endTime);
      };

      complete = function(e) {
          e.preventDefault();

          var layerOffset = editor.drawer.findLayerOffset(e.target),
              endX = layerOffset + (e.layerX || e.offsetX),
              minX, maxX,
              startTime, endTime;

          minX = Math.min(startX, endX);
          maxX = Math.max(startX, endX);

          startTime = editor.pixelsToSeconds(minX);
          endTime = editor.pixelsToSeconds(maxX);
          editor.notifySelectUpdate(startTime, endTime, e.shiftKey);

          el.onmousemove = el.onmouseup = el.onmouseleave = null;
      };

      el.onmouseup = el.onmouseleave = complete;
  }
};