'use strict';

WaveformPlaylist.states = WaveformPlaylist.states || {};

/*
  called with an instance of Track as 'this'
*/

WaveformPlaylist.states.select = {

    classes: "state-select",

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
      This is used when in 'select' state as a mousedown event
    */
    event: function(e) {
        e.preventDefault();

        var el = this.container, //want the events placed on the channel wrapper.
            editor = this,
            startX,
            startTime,
            complete;

        startX = editor.drawer.findClickedPixel(e);
        startTime = editor.pixelsToSeconds(startX);

        //dynamically put an event on the element.
        el.onmousemove = function(e) {
            e.preventDefault();

            var currentX = editor.drawer.findClickedPixel(e),
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

            var endX = editor.drawer.findClickedPixel(e),
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