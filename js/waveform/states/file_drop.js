'use strict';

WaveformPlaylist.states = WaveformPlaylist.states || {};

/*
  called with an instance of Track as 'this'
*/

WaveformPlaylist.states.fileDrop = {

    classes: {
        container: "state-file-drop",
        drag: "drag-enter"
    },

    enter: function() {
        var state = this.currentState;

        this.container.classList.add(state.classes.container);

        this.container.ondragenter = state.dragenter.bind(this);
        this.container.ondragover = state.dragover.bind(this);
        this.container.ondragleave = state.dragleave.bind(this);
        this.container.ondrop = state.drop.bind(this);
    },

    leave: function() {
        var state = this.currentState;

        this.container.ondragenter = null;
        this.container.ondragover = null;
        this.container.ondragleave = null;
        this.container.ondrop = null;
        this.container.classList.remove(state.classes.container);
    },

    dragenter: function() {
        var state = this.currentState;

        this.container.classList.add(state.classes.drag);
    },

    dragover: function(e) {
        e.stopPropagation();
        e.preventDefault();
    },

    dragleave: function() {
        var state = this.currentState;

        this.container.classList.remove(state.classes.drag);
    },

    drop: function(e) {
        e.stopPropagation();
        e.preventDefault();

        var state = this.currentState;

        this.container.classList.remove(state.classes.drag);

        if (e.dataTransfer.files.length) {
            this.loadBlob(e.dataTransfer.files[0]);
        }
    }
};