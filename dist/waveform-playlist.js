/*! waveform-playlist 0.3.1
Written by: Naomi Aro
Website: http://naomiaro.github.io/waveform-playlist
License: MIT */
'use strict';

var WaveformPlaylist = {

    init: function(tracks) {
        var that = this,
            i,
            len,
            container = this.config.getContainer(),
            div = container.querySelector(".playlist-tracks"),
            fragment = document.createDocumentFragment(),
            trackEditor,
            trackElem,
            audioControls;

        tracks = tracks || [];

        WaveformPlaylist.makePublisher(this);

        this.storage = Object.create(WaveformPlaylist.Storage);

        container.style.overflow = "hidden";
        container.style.position = "relative";

        this.trackContainer = div;
        this.trackContainer.style.overflow = "auto";

        this.trackEditors = [];

        audioControls = Object.create(WaveformPlaylist.AudioControls, {
            config: {
                value: this.config
            }
        });
        audioControls.init();

        if (this.config.isTimeScaleEnabled()) {
            this.timeScale = Object.create(WaveformPlaylist.TimeScale, {
                config: {
                    value: this.config
                }
            });
            this.timeScale.init();

            audioControls.on("changeresolution", "onResolutionChange", this.timeScale);
            this.on("trackscroll", "onTrackScroll", this.timeScale);
        }
        
        for (i = 0, len = tracks.length; i < len; i++) {

            trackEditor = Object.create(WaveformPlaylist.TrackEditor, {
                config: {
                    value: this.config
                }
            });
            trackElem = trackEditor.loadTrack(tracks[i]);
        
            this.trackEditors.push(trackEditor);
            fragment.appendChild(trackElem);

            trackEditor.on("trackloaded", "onTrackLoad", this);
            trackEditor.on("changeshift", "onChangeShift", this);
        }

        this.trackContainer.appendChild(fragment);
        this.trackContainer.onscroll = this.onTrackScroll.bind(this);

        this.sampleRate = this.config.getSampleRate();
       
        this.scrollTimeout = false;

        //for requestAnimationFrame that's toggled during play/stop.
        this.animationRequest;
        this.animationCallback = this.updateEditor.bind(this);

        this.on("playbackcursor", "onAudioUpdate", audioControls);

        audioControls.on("newtrack", "createTrack", this);
        audioControls.on("playlistsave", "save", this);
        audioControls.on("playlistrestore", "restore", this);
        audioControls.on("rewindaudio", "rewind", this);
        audioControls.on("fastforwardaudio", "fastForward", this);
        audioControls.on("playaudio", "play", this);
        audioControls.on("pauseaudio", "pause", this);
        audioControls.on("stopaudio", "stop", this);
        audioControls.on("trimaudio", "onTrimAudio", this);
        audioControls.on("changestate", "onStateChange", this);
        audioControls.on("changeselection", "onSelectionChange", this);
        audioControls.on("changevolume", "onTrackVolumeChange", this);
        audioControls.on("mutetrack", "onMuteTrack", this);
        audioControls.on("solotrack", "onSoloTrack", this);

        this.audioControls = audioControls;

        this.mutedTracks = [];
        this.soloedTracks = [];
        this.playoutPromises = [];
    },

    createTrack: function() {
        var trackEditor = Object.create(WaveformPlaylist.TrackEditor, {
            config: {
                value: this.config
            }
        });
        var trackElem = trackEditor.init();

        trackEditor.setState('fileDrop');
    
        this.trackEditors.push(trackEditor);
        this.trackContainer.appendChild(trackElem);

        trackEditor.on("trackloaded", "onTrackLoad", this);
    },

    removeTrack: function(trackEditor) {
        var i, 
            len, 
            editor,
            editors = this.trackEditors;
        
        for (i = 0, len = editors.length; i < len; i++) {
            editor = editors[i];

            if (editor === trackEditor) {
                editors.splice(i, 1);
                return;
            }
        }
    },

    onTrackLoad: function(trackEditor) {

        this.audioControls.on("trackedit", "onTrackEdit", trackEditor);
        this.audioControls.on("changeresolution", "onResolutionChange", trackEditor);

        trackEditor.on("activateSelection", "onAudioSelection", this.audioControls);
        trackEditor.on("deactivateSelection", "onAudioDeselection", this.audioControls);
        trackEditor.on("changecursor", "onCursorSelection", this.audioControls);
        trackEditor.on("changecursor", "onSelectUpdate", this);

        //only one track should be preloaded with a selected area.
        if (trackEditor.selectedArea !== undefined) {
            this.activateTrack(trackEditor);
        }
    },

    resize: function() {
        this.timeScale.onResize();
    },

    onTrimAudio: function() {
        this.activeTrack && this.activeTrack.trim(); 
    },

    /*
        Called when a user manually updates the cue points in the UI.
        args start/end are in seconds
    */
    onSelectionChange: function(args) {
        this.config.setCursorPos(args.start);
        this.activeTrack && this.activeTrack.setSelectedArea(args.start, args.end);
    },

    setState: function(state) {
        this.trackEditors.forEach(function(editor) {
            editor.setState(state);
        }, this);
    },

    onStateChange: function() {
        var state = this.config.getState();

        this.trackEditors.forEach(function(editor) {
            editor.deactivate();
        }, this);

        this.setState(state);
    },

    onTrackScroll: function() {
        var that = this;

        if (that.scrollTimeout) return;

        //limit the scroll firing to every 25ms.
        that.scrollTimeout = setTimeout(function() {
            
            that.config.setTrackScroll(that.trackContainer.scrollLeft, that.trackContainer.scrollTop);
            that.fire('trackscroll', that.trackContainer.scrollLeft, that.trackContainer.scrollTop);
            that.scrollTimeout = false;
        }, 25);   
    },

    onTrackVolumeChange: function(data) {
        var editors = this.trackEditors,
            i,
            len,
            editor,
            gain = data.gain,
            trackElement = data.trackElement;

        for (i = 0, len = editors.length; i < len; i++) {
            editor = editors[i];

            if (editor.container === trackElement) {
                editor.setGainLevel(gain);
            }
        }
    },

    adjustTrackPlayout: function() {
        var masterGain;

        this.trackEditors.forEach(function(editor) {
            masterGain = this.shouldTrackPlay(editor) ? 1 : 0;
            editor.setMasterGainLevel(masterGain);
        }, this);
    },

    onMuteTrack: function(trackElement) {
        var editors = this.trackEditors,
            i,
            len,
            editor,
            index;

        for (i = 0, len = editors.length; i < len; i++) {
            editor = editors[i];

            if (editor.container === trackElement) {
                index = this.mutedTracks.indexOf(editor);
                if (index > -1) {
                    this.mutedTracks.splice(index, 1);
                }
                else {
                    this.mutedTracks.push(editor);
                }
            }
        }

        this.adjustTrackPlayout();

    },

    onSoloTrack: function(trackElement) {
        var editors = this.trackEditors,
            i,
            len,
            editor,
            index;

        for (i = 0, len = editors.length; i < len; i++) {
            editor = editors[i];

            if (editor.container === trackElement) {
                index = this.soloedTracks.indexOf(editor);
                if (index > -1) {
                    this.soloedTracks.splice(index, 1);
                }
                else {
                    this.soloedTracks.push(editor);
                }
            }
        }

        this.adjustTrackPlayout();
    },

    activateTrack: function(trackEditor) {
        this.trackEditors.forEach(function(editor) {
            if (editor === trackEditor) {
                editor.activate();
                this.activeTrack = trackEditor;
            }
            else {
                editor.deactivate();
            }
        }, this);
    },

    onSelectUpdate: function(event) {
        var track = event.editor;

        this.activateTrack(track);

        //seeking while playing occuring
        if (this.isPlaying()) {
            this.lastSeeked = event.start;
            this.pausedAt = undefined;
            this.restartPlayFrom(event.start);
        }
        else {
            //new cursor selected while paused.
            if (this.pausedAt !== undefined) {
                this.pausedAt = undefined;

                this.trackEditors.forEach(function(editor) {
                    editor.showProgress(0);
                }, this);
            }

            track.setSelectedArea(event.start, event.end, event.shiftKey);
        }
    },

    onChangeShift: function(event) {
        var editors = this.trackEditors,
            i,
            len,
            maxTrackLengthPixels = 0,
            maxTrackLengthSeconds = 0;

        for (i = 0, len = editors.length; i < len; i++) {
            maxTrackLengthPixels = Math.max(maxTrackLengthPixels, editors[i].drawer.containerWidth);
            maxTrackLengthSeconds = Math.max(maxTrackLengthSeconds, editors[i].endTime);
        }

        //set the width so that the entire area will be selectable when needed.
        for (i = 0, len = editors.length; i < len; i++) {
            editors[i].drawer.updateContainerWidth(maxTrackLengthPixels);
        }

        this.duration = maxTrackLengthSeconds;
    },

    rewind: function() {
        this.stop();

        Promise.all(this.playoutPromises).then((function() {
            if (this.activeTrack !== undefined) {
                this.activeTrack.setSelectedArea(0, 0, false);
                this.activeTrack.notifySelectUpdate(0, 0);
            }
            else {
                this.config.setCursorPos(0);
            }

            this.trackContainer.scrollLeft = 0;
            this.config.setTrackScroll(0);
            this.fire('trackscroll');
        }).bind(this));
    },

    fastForward: function() {
        var totalWidth = this.trackContainer.scrollWidth,
            clientWidth = this.trackContainer.offsetWidth,
            maxOffset = Math.max(totalWidth - clientWidth, 0);

        this.stop();

        Promise.all(this.playoutPromises).then((function() {
            if (this.activeTrack !== undefined) {
                this.activeTrack.setSelectedArea(this.duration, this.duration, false);
                this.activeTrack.notifySelectUpdate(this.duration, this.duration);
            }
            else {
                this.config.setCursorPos(this.duration);
            }

            this.trackContainer.scrollLeft = maxOffset;
            this.config.setTrackScroll(maxOffset);
            this.fire('trackscroll');
        }).bind(this));
    },

    /*
        returns selected time in global (playlist relative) seconds.
    */
    getSelected: function() {
        if (this.activeTrack) {
            return this.activeTrack.selectedArea;
        }
    },

    isPlaying: function() {
         var editors = this.trackEditors,
            i,
            len,
            isPlaying = false;

        for (i = 0, len = editors.length; i < len; i++) {
            isPlaying = isPlaying || editors[i].isPlaying();
        }

        return isPlaying;
    },

    shouldTrackPlay: function(trackEditor) {
        var shouldPlay;
        //if there are solo tracks, only they should play.
        if (this.soloedTracks.length > 0) {
            shouldPlay = false;
            if (this.soloedTracks.indexOf(trackEditor) > -1) {
                shouldPlay = true;
            }
        }
        //play all tracks except any muted tracks.
        else {
            shouldPlay = true;
            if (this.mutedTracks.indexOf(trackEditor) > -1) {
                shouldPlay = false;
            }
        }

        return shouldPlay;
    },

    restartPlayFrom: function(cursorPos) {
        this.stopAnimation();

        this.trackEditors.forEach(function(editor) {
            editor.scheduleStop();
        }, this);

        Promise.all(this.playoutPromises).then(this.play.bind(this, cursorPos));
    },

    /*
    *   returns the current point of time in the playlist in seconds.
    */
    getCurrentTime: function() {
        var cursorPos = this.lastSeeked || this.pausedAt || this.config.getCursorPos();

        return cursorPos + this.getElapsedTime();
    },

    getElapsedTime: function() {
        var currentTime = this.config.getCurrentTime();

        return currentTime - this.lastPlay;
    },

    play: function(startTime) {
        var currentTime = this.config.getCurrentTime(),
            endTime,
            selected = this.getSelected(),
            playoutPromises = [];

        startTime = startTime || this.pausedAt || this.config.getCursorPos();

        if (selected !== undefined && selected.endTime > startTime) {
            endTime = selected.endTime;
        }

        this.setState('cursor');

        this.trackEditors.forEach(function(editor) {
            playoutPromises.push(editor.schedulePlay(currentTime, startTime, endTime, {
                masterGain: this.shouldTrackPlay(editor) ? 1 : 0
            }));
        }, this);

        this.lastPlay = currentTime;
        //use these to track when the playlist has fully stopped.
        this.playoutPromises = playoutPromises;
        this.startAnimation(startTime);
    },

    pause: function() {
        if (!this.isPlaying()) {
            return;
        }

        this.pausedAt = this.getCurrentTime();
        this.lastSeeked = undefined;

        this.stopAnimation();

        this.trackEditors.forEach(function(editor) {
            editor.scheduleStop();
        }, this);

        this.setState(this.config.getState());
    },

    stop: function() {
        this.pausedAt = undefined;
        this.lastSeeked = undefined;

        this.stopAnimation();

        this.trackEditors.forEach(function(editor) {
            editor.scheduleStop();
            editor.showProgress(0);
        }, this);

        this.setState(this.config.getState());
    },

    /*
      Animation function for the playlist.
    */
    updateEditor: function(cursorPos) {
        var currentTime = this.config.getCurrentTime(),
            playbackSec = cursorPos,
            elapsed;

        cursorPos = cursorPos || this.config.getCursorPos();
        elapsed = currentTime - this.lastDraw;

        if (this.isPlaying()) {
            //if there's a change for the UI show progress.
            if (elapsed) {
                playbackSec = cursorPos + elapsed;

                this.trackEditors.forEach(function(editor) {
                    editor.showProgress(playbackSec);
                }, this);

                this.fire("playbackcursor", {
                    "seconds": playbackSec
                });
            }
            this.animationRequest = window.requestAnimationFrame(this.animationCallback.bind(this, playbackSec));
        }
        else {
            //reset view to not playing look
            this.stopAnimation();

            this.trackEditors.forEach(function(editor) {
                editor.showProgress(0);
            }, this);

            this.pausedAt = undefined;
            this.lastSeeked = undefined;
        }

        this.lastDraw = currentTime;
    },

    startAnimation: function(startTime) {
        this.lastDraw = this.config.getCurrentTime();
        this.animationRequest = window.requestAnimationFrame(this.animationCallback.bind(this, startTime));
    },

    stopAnimation: function() {
        window.cancelAnimationFrame(this.animationRequest);
        this.lastDraw = undefined;
    },

    getInfo: function() {
        var info = [];

        this.trackEditors.forEach(function(editor) {
            info.push(editor.getTrackDetails());
        }, this);

        return info;
    },

    getJson: function() {
        return JSON.stringify(this.getInfo());
    },

    save: function() {
        this.storage.save("test", this.getInfo());
    },

    restore: function() {
        var state = this.storage.restore("test");;

        this.destroy();
        this.init(state);
    },

    destroy: function() {
        this.trackEditors.forEach(function(editor) {
            editor.destroy();
        }, this);

        this.trackContainer.innerHTML = '';
    }
};

WaveformPlaylist.unitConversions = {

    samplesToSeconds: function(samples) {
        return samples / this.sampleRate;
    },

    secondsToSamples: function(seconds) {
        return Math.ceil(seconds * this.sampleRate);
    },

    samplesToPixels: function(samples) {
        return ~~(samples / this.resolution);
    },

    pixelsToSamples: function(pixels) {
        return ~~(pixels * this.resolution);
    },

    pixelsToSeconds: function(pixels) {
        return pixels * this.resolution / this.sampleRate;
    },

    secondsToPixels: function(seconds) {
        return ~~(seconds * this.sampleRate / this.resolution);
    }
};
'use strict';

WaveformPlaylist.curves = {

    createLinearBuffer: function createLinearBuffer(length, rotation) {
        var curve = new Float32Array(length),
            i, x,
            scale = length - 1;

        for (i = 0; i < length; i++) {
            x = i / scale;

            if (rotation > 0) {
                curve[i] = x;
            }
            else {
                curve[i] = 1 - x;
            }  
        }
        return curve;
    },

    createExponentialBuffer: function createExponentialBuffer(length, rotation) {
        var curve = new Float32Array(length),
            i, x,
            scale = length - 1,
            index;

        for (i = 0; i < length; i++) {
            x = i / scale;
            index = rotation > 0 ? i : length - 1 - i;
           
            curve[index] = Math.exp(2 * x - 1) / Math.exp(1);
        }
        return curve;
    },

    //creating a curve to simulate an S-curve with setValueCurveAtTime.
    createSCurveBuffer: function createSCurveBuffer(length, phase) {
        var curve = new Float32Array(length),
            i;

        for (i = 0; i < length; ++i) {
            curve[i] = (Math.sin((Math.PI * i / length) - phase)) /2 + 0.5;
        }
        return curve;
    },

    //creating a curve to simulate a logarithmic curve with setValueCurveAtTime.
    createLogarithmicBuffer: function createLogarithmicBuffer(length, base, rotation) {
        var curve = new Float32Array(length),
            index,
            key = ""+length+base+rotation,
            store = [],
            x = 0,
            i;

        if (store[key]) {
            return store[key];
        }

        for (i = 0; i < length; i++) {
            //index for the curve array.
            index = rotation > 0 ? i : length - 1 - i;

            x = i / length;
            curve[index] = Math.log(1 + base*x) / Math.log(1 + base);
        }

        store[key] = curve;

        return curve;
    }
};

'use strict';

WaveformPlaylist.mixin = function(object, mixin) {
    Object.keys(mixin).forEach(function(key) {
        object[key] = mixin[key];
    });
};
WaveformPlaylist.publisher = {
    subscribers: {
        any: []
    },
    on: function (type, fn, context) {
        type = type || 'any';
        fn = typeof fn === "function" ? fn : context[fn];
        
        if (typeof this.subscribers[type] === "undefined") {
            this.subscribers[type] = [];
        }
        this.subscribers[type].push({fn: fn, context: context || this});
    },
    remove: function (type, fn, context) {
        this.visitSubscribers('unsubscribe', type, fn, context);
    },
    fire: function (type, publication) {
        this.visitSubscribers('publish', type, publication);
    },
    reset: function () {
        this.subscribers = {any: []};
    },
    visitSubscribers: function (action, type, arg, context) {
        var pubtype = type || 'any',
            subscribers = this.subscribers[pubtype],
            i,
            max = subscribers ? subscribers.length : 0;
            
        for (i = 0; i < max; i += 1) {
            if (action === 'publish') {
                subscribers[i].fn.call(subscribers[i].context, arg);
            } 
            else {
                if (subscribers[i].fn === arg && subscribers[i].context === context) {
                    subscribers.splice(i, 1);
                }
            }
        }
    }
};


WaveformPlaylist.makePublisher = function(o) {
    var i,
        publisher = WaveformPlaylist.publisher;

    for (i in publisher) {
        if (publisher.hasOwnProperty(i) && typeof publisher[i] === "function") {
            o[i] = publisher[i];
        }
    }
    o.subscribers = {any: []};
}

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
'use strict';

WaveformPlaylist.states = WaveformPlaylist.states || {};

/*
  called with an instance of Track as 'this'
*/
WaveformPlaylist.states.fadein = {

  classes: "state-fadein",

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

  event: function(e) {
    var startX = this.drawer.findClickedPixel(e), //relative to e.target
        FADETYPE = "FadeIn",
        shape = this.config.getFadeType(),
        trackStartPix = this.drawer.pixelOffset,
        trackEndPix = trackStartPix + this.drawer.width;

    this.removeFadeType(FADETYPE);

    if (trackStartPix <= startX && trackEndPix >= startX) {
      this.createFade(FADETYPE, shape, 0, (startX - trackStartPix));
    }
  }
};
'use strict';

WaveformPlaylist.states = WaveformPlaylist.states || {};

/*
  called with an instance of Track as 'this'
*/
WaveformPlaylist.states.fadeout = {

  classes: "state-fadeout",

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

  event: function(e) {
    var startX = this.drawer.findClickedPixel(e), //relative to e.target (want the canvas).
        FADETYPE = "FadeOut",
        shape = this.config.getFadeType(),
        trackStartPix = this.drawer.pixelOffset,
        trackEndPix = trackStartPix + this.drawer.width;

    this.removeFadeType(FADETYPE);

    if (trackStartPix <= startX && trackEndPix >= startX) {
      this.createFade(FADETYPE, shape, (startX - trackStartPix), this.drawer.width);
    }
  }
};
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

        var el = this.drawer.waveformContainer, //want the events placed on the waveform wrapper.
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
'use strict';

WaveformPlaylist.states = WaveformPlaylist.states || {};

/*
  called with an instance of Track as 'this'
*/
WaveformPlaylist.states.shift = {

  classes: "state-shift",

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
      mousedown event in 'shift' mode
  */
  event: function(e) {
      e.preventDefault();

      var el = this.drawer.waveformContainer, //want the events placed on the waveform wrapper.
          editor = this,
          startX = e.pageX, 
          diffX = 0, 
          updatedX = 0,
          origX = editor.leftOffset / editor.resolution,
          complete;

      //dynamically put an event on the element.
      el.onmousemove = function(e) {
          e.preventDefault();

          var endX = e.pageX;
          
          diffX = endX - startX;
          updatedX = origX + diffX;
          editor.setLeftOffset(editor.pixelsToSamples(updatedX));
      };

      complete = function(e) {
          e.preventDefault();

          var delta = editor.pixelsToSeconds(diffX);

          el.onmousemove = el.onmouseup = el.onmouseleave = null;

          //update track's start and end time relative to the playlist.
          //TODO this should probably be done in the mousemove event.
          editor.startTime = editor.startTime + delta;
          editor.endTime = editor.endTime + delta;

          editor.setLeftOffset(editor.pixelsToSamples(updatedX));
      };

      el.onmouseup = el.onmouseleave = complete;
  }
};
'use strict';

/*
    Stores configuration settings for the waveform playlist.
    A container object (ex a div) must be passed in, the playlist will be built on this element.
*/

WaveformPlaylist.Config = function(params) {

        var that = this,
            defaultParams;

        defaultParams = {

            ac: new (window.AudioContext || window.webkitAudioContext),

            resolution: 4096, //resolution - frames per pixel to draw.
            minResolution: 500,
            maxResolution: 20000,
            timeFormat: 'hh:mm:ss.uu',
            mono: true, //whether to draw multiple channels or combine them.
            fadeType: 'logarithmic',

            timescale: false, //whether or not to include the time measure.
            controls: {
                show: false, //whether or not to include the track controls
                width: 150, //width of controls in pixels
            },

            UITheme: "default", // bootstrap || jQueryUI || default

            waveOutlineColor: 'white',
            timeColor: 'grey',
            fadeColor: 'black',

            waveHeight: 128, //height of each canvas element a waveform is on.

            trackscroll: {
                left: 0,
                top: 0
            },

            state: 'select',

            cursorPos: 0 //value is kept in seconds.
        };

        params = Object.create(params);
        Object.keys(defaultParams).forEach(function(key) {
            if (!(key in params)) { 
                params[key] = defaultParams[key]; 
            }
        });


        /*
            Start of all getter methods for config.
        */

        that.getContainer = function getContainer() {
            return params.container;
        };

        that.isTimeScaleEnabled = function isTimeScaleEnabled() {
            return params.timescale;
        };

        that.getFadeType = function getFadeType() {
            return params.fadeType;
        };

        that.isDisplayMono = function isDisplayMono() {
            return params.mono;
        };

        that.getUITheme = function getUITheme() {
            return params.UITheme;
        };

        that.getCursorPos = function getCursorPos() {
            return params.cursorPos;
        };

        that.getState = function getState() {
            return params.state;
        };

        that.getAudioContext = function getAudioContext() {
            return params.ac;
        };

        that.getSampleRate = function getSampleRate() {
            return params.ac.sampleRate;
        };

        that.getCurrentTime = function getCurrentTime() {
            return params.ac.currentTime;
        };

        that.getTimeFormat = function getTimeFormat() {
            return params.timeFormat;
        };

        that.getMinResolution = function getResolution() {
            return params.minResolution;
        };

        that.getMaxResolution = function getResolution() {
            return params.maxResolution;
        };

        that.getResolution = function getResolution() {
            return params.resolution;
        };

        that.getWaveHeight = function getWaveHeight() {
            return params.waveHeight;
        };

        that.getColorScheme = function getColorScheme() {
            return {
                waveOutlineColor: params.waveOutlineColor,
                timeColor: params.timeColor,
                fadeColor: params.fadeColor,
                selectBorderColor: params.selectBorderColor,
                selectBackgroundColor: params.selectBackgroundColor, 
            };
        };

        that.getControlSettings = function getControlSettings() {
            return {
                show: params.controls.show,
                width: params.controls.width
            }
        };

        that.getTrackScroll = function getTrackScroll() {
            var scroll = params.trackscroll;
        
            return {
                left: scroll.left,
                top: scroll.top
            };
        };


        /*
            Start of all setter methods for config.
        */

        that.setResolution = function setResolution(resolution) {
            params.resolution = resolution;
        };

        that.setTimeFormat = function setTimeFormat(format) {
            params.timeFormat = format;
        };

        that.setFadeType = function setFadeType(type) {
            params.fadeType = type;
        };

        that.setDisplayMono = function setDisplayMono(bool) {
            params.mono = bool;
        };

        that.setCursorPos = function setCursorPos(pos) {
            params.cursorPos = pos;
        };

        that.setState = function setState(state) {
            params.state = state;
        };

        that.setTrackScroll = function setTrackScroll(left, top) {
            var scroll = params.trackscroll;

            scroll.left = (left !== undefined) ? left : scroll.left;
            scroll.top = (top !== undefined) ? top : scroll.top;
        };
};

'use strict';

WaveformPlaylist.AudioControls = {

    groups: {
        "audio-select": ["btns_audio_tools"]
    },

    classes: {
        "disabled": "disabled",
        "active": "active"
    },

    eventTypes: {
        "onclick": {
            "btn-rewind": "rewindAudio",
            "btn-fast-forward": "fastForwardAudio",
            "btn-play": "playAudio",
            "btn-pause": "pauseAudio",
            "btn-stop": "stopAudio",
            "btn-state": "changeState",
            "btn-save": "save",
            "btn-open": "open",
            "btn-trim-audio": "trimAudio",
            "btn-fade": "changeDefaultFade",
            "btn-zoom-in": "zoomIn",
            "btn-zoom-out": "zoomOut",
            "btn-new-track": "newTrack",
            "btn-mute": "muteTrack",
            "btn-solo": "soloTrack"
        },
        "onchange": {
            "time-format": "changeTimeFormat"
        },
        "oninput": {
            "volume-slider": "changeVolume"
        }
    },

    init: function() {
        var state,
            container,
            fadeType,
            tmpEl,
            tmpBtn;

        WaveformPlaylist.makePublisher(this);

        container = this.config.getContainer();
        state = this.config.getState();
        fadeType = this.config.getFadeType();

        //controls we should keep a reference to.
        this.ctrls = {};
        this.ctrls["time-format"] = container.querySelector(".time-format");
        this.ctrls["audio-start"] = container.querySelector(".audio-start");
        this.ctrls["audio-end"] = container.querySelector(".audio-end");
        this.ctrls["audio-pos"] = container.querySelector(".audio-pos");

        //set current state and fade type on playlist
        [".btn-state[data-state='"+state+"']", ".btn-fade[data-fade='"+fadeType+"']"].forEach(function(buttonClass) {
            tmpBtn = container.querySelector(buttonClass);

            if (tmpBtn) {
                this.activateButton(tmpBtn);
            }
        }, this);  

        Object.keys(this.eventTypes).forEach(function(event) {
            var that = this;

            //all events are delegated to the main container.
            (function(eventName, classNames) {
                container[eventName] = function(e) {
                    //check if the event target has a special class name.
                    var data = that.nodeChainContainsClassName(e.currentTarget, e.target, classNames);
                    var className;

                    if (data && (className = data['className'])) {
                        that[that.eventTypes[eventName][className]].call(that, e);
                    }
                };
            })(event, Object.keys(this.eventTypes[event]));

        }, this);

        if (this.ctrls["time-format"]) {
            this.ctrls["time-format"].value = this.config.getTimeFormat();
        }

        //TODO, need better alternative? onfocusout not in firefox and blur doesn't bubble.
        if (this.ctrls["time-format"]) {
            this.ctrls["audio-start"].onblur = this.validateCueIn.bind(this);
        }
        if (this.ctrls["time-format"]) {
            this.ctrls["audio-end"].onblur = this.validateCueOut.bind(this);
        }

        this.timeFormat = this.config.getTimeFormat();

        //Kept in seconds so time format change can update fields easily.
        this.currentSelectionValues = undefined;

        this.onCursorSelection({
            start: 0,
            end: 0
        });
    },

    nodeChainContainsClassName: function(parent, node, classNames) {
        var i, len, className, currentNode;

        currentNode = node;

        while (currentNode) {
            for (i = 0, len = classNames.length; i < len; i++) {
                className = classNames[i];
                if (currentNode.classList.contains(className)) {
                    return {
                        'className': className,
                        'node': currentNode
                    };
                }
            }

            if (currentNode === parent) {
                break;
            }
            currentNode = currentNode.parentElement; 
        }   
    },

    validateCue: function(value) {
        var validators,
            regex,
            result;

        validators = {
            "seconds": /^\d+$/,
            "thousandths": /^\d+\.\d{3}$/,
            "hh:mm:ss": /^[0-9]{2,}:[0-5][0-9]:[0-5][0-9]$/,
            "hh:mm:ss.u": /^[0-9]{2,}:[0-5][0-9]:[0-5][0-9]\.\d{1}$/,
            "hh:mm:ss.uu": /^[0-9]{2,}:[0-5][0-9]:[0-5][0-9]\.\d{2}$/,
            "hh:mm:ss.uuu": /^[0-9]{2,}:[0-5][0-9]:[0-5][0-9]\.\d{3}$/
        };

        regex = validators[this.timeFormat];
        result = regex.test(value);

        return result;
    },

    cueToSeconds: function(value) {
        var converter,
            func,
            seconds;

        function clockConverter(value) {
            var data = value.split(":"),
                hours = parseInt(data[0], 10) * 3600,
                mins = parseInt(data[1], 10) * 60,
                secs = parseFloat(data[2]),
                seconds;

            seconds = hours + mins + secs;

            return seconds;
        }

        converter = {
            "seconds": function(value) {
                return parseInt(value, 10);
            },
            "thousandths": function(value) {
                return parseFloat(value);
            },
            "hh:mm:ss": function(value) {
                return clockConverter(value);
            },
            "hh:mm:ss.u": function(value) {
                return clockConverter(value);
            },
            "hh:mm:ss.uu": function(value) {
                return clockConverter(value);
            },
            "hh:mm:ss.uuu": function(value) {
                return clockConverter(value);
            } 
        };

        func = converter[this.timeFormat];
        seconds = func(value);

        return seconds;
    },

    cueFormatters: function(format) {

        function clockFormat(seconds, decimals) {
            var hours,
                minutes,
                secs,
                result;

            hours = parseInt(seconds / 3600, 10) % 24;
            minutes = parseInt(seconds / 60, 10) % 60;
            secs = seconds % 60;
            secs = secs.toFixed(decimals);

            result = (hours < 10 ? "0" + hours : hours) + ":" + (minutes < 10 ? "0" + minutes : minutes) + ":" + (secs < 10 ? "0" + secs : secs);

            return result;
        }

        var formats = {
            "seconds": function (seconds) {
                return seconds.toFixed(0);
            },
            "thousandths": function (seconds) {
                return seconds.toFixed(3);
            },
            "hh:mm:ss": function (seconds) {
                return clockFormat(seconds, 0);   
            },
            "hh:mm:ss.u": function (seconds) {
                return clockFormat(seconds, 1);   
            },
            "hh:mm:ss.uu": function (seconds) {
                return clockFormat(seconds, 2);   
            },
            "hh:mm:ss.uuu": function (seconds) {
                return clockFormat(seconds, 3);   
            }
        };

        return formats[format];
    },

    changeTimeFormat: function(e) {
        var format = e.target.value,
            func, start, end;

        format = (this.cueFormatters(format) !== undefined) ? format : "hh:mm:ss";
        this.config.setTimeFormat(format);
        this.timeFormat = format;

        if (this.currentSelectionValues !== undefined) {
            func = this.cueFormatters(format);
            start = this.currentSelectionValues.start;
            end = this.currentSelectionValues.end;

            if (this.ctrls["audio-start"]) {
                this.ctrls["audio-start"].value = func(start);
            }

            if (this.ctrls["audio-end"]) {
                this.ctrls["audio-end"].value = func(end);
            }
        }
    },

    zoomIn: function() {
        var newRes = this.config.getResolution() * (3/4),
            min = this.config.getMinResolution();

        newRes = (newRes < min) ? min : newRes;

        if (newRes > min) {
            this.zoom(newRes);
        }
    },

    zoomOut: function() {
        var newRes = this.config.getResolution() * (4/3),
            max = this.config.getMaxResolution();

        newRes = (newRes > max) ? max : newRes;

        if (newRes < max) {
            this.zoom(newRes);
        }
    },

    zoom: function(res) {
        this.config.setResolution(res);
        this.fire("changeresolution", res);
    },

    newTrack: function() {
        this.fire("newtrack");
    },

    validateCueIn: function(e) {
        var value = e.target.value,
            end,
            startSecs;

        if (this.validateCue(value)) {
            end = this.currentSelectionValues.end;
            startSecs = this.cueToSeconds(value);

            if (startSecs <= end) {
                this.notifySelectionUpdate(startSecs, end);
                this.currentSelectionValues.start = startSecs;
                return;
            }
        }

        //time entered was otherwise invalid.
        e.target.value = this.cueFormatters(this.timeFormat)(this.currentSelectionValues.start);
    },

    validateCueOut: function(e) {
        var value = e.target.value,
            start,
            endSecs;

        if (this.validateCue(value)) {
            start = this.currentSelectionValues.start;
            endSecs = this.cueToSeconds(value);

            if (endSecs >= start) {
                this.notifySelectionUpdate(start, endSecs);
                this.currentSelectionValues.end = endSecs;
                return;
            }
        }

        //time entered was otherwise invalid.
        e.target.value = this.cueFormatters(this.timeFormat)(this.currentSelectionValues.end);
    },

    activateButtonGroup: function(id) {
        var el = document.getElementById(id),
            btns,
            classes = this.classes,
            i, len;

        if (el === null) {
            return;
        }

        btns = el.children;

        for (i = 0, len = btns.length; i < len; i++) {
            btns[i].classList.remove(classes["disabled"]);
        }
    },

    deactivateButtonGroup: function(id) {
        var el = document.getElementById(id),
            btns,
            classes = this.classes,
            i, len;

        if (el === null) {
            return;
        }

        btns = el.children;

        for (i = 0, len = btns.length; i < len; i++) {
            btns[i].classList.add(classes["disabled"]);
        }
    },

    activateAudioSelection: function() {
        var ids = this.groups["audio-select"],
            i, len;

        for (i = 0, len = ids.length; i < len; i++) {
            this.activateButtonGroup(ids[i]);
        }
    },

    deactivateAudioSelection: function() {
        var ids = this.groups["audio-select"],
            i, len;

        for (i = 0, len = ids.length; i < len; i++) {
            this.deactivateButtonGroup(ids[i]);
        }
    },

    save: function() {
        this.fire('playlistsave');
    },

    open: function() {
        this.fire('playlistrestore');
    },

    rewindAudio: function() {
        this.fire('rewindaudio');
    },

    fastForwardAudio: function() {
        this.fire('fastforwardaudio');
    },

    playAudio: function() {
        this.fire('playaudio');
    },

    pauseAudio: function() {
        this.fire('pauseaudio');
    },

    stopAudio: function() {
        this.fire('stopaudio');
    },

    changeVolume: function(e) {
        var container = this.config.getContainer();
        var track = this.nodeChainContainsClassName(e.currentTarget, e.target, ["channel-wrapper"])["node"];

        this.fire('changevolume', {
            trackElement: track,
            gain: e.target.value/100
        });
    },

    muteTrack: function(e) {
        var el = this.nodeChainContainsClassName(e.currentTarget, e.target, ["btn-mute"])["node"];
        var track = this.nodeChainContainsClassName(e.currentTarget, el, ["channel-wrapper"])["node"];

        el.classList.toggle(this.classes["active"]);

        this.fire('mutetrack', track);
    },

    soloTrack: function(e) {
        var el = this.nodeChainContainsClassName(e.currentTarget, e.target, ["btn-solo"])["node"];
        var track = this.nodeChainContainsClassName(e.currentTarget, el, ["channel-wrapper"])["node"];

        el.classList.toggle(this.classes["active"]);

        this.fire('solotrack', track);
    },

    activateButton: function(el) {
        if (el) {
            el.classList.add(this.classes["active"]);
        }
    },

    deactivateButton: function(el) {
        if (el) {
            el.classList.remove(this.classes["active"]);
        }
    },

    enableButton: function(el) {
        if (el) {
            el.classList.remove(this.classes["disabled"]);
        }
    },

    disableButton: function(el) {
        if (el) {
            el.classList.add(this.classes["disabled"]);
        }
    },

    changeState: function(e) {
        var nodeData = this.nodeChainContainsClassName(e.currentTarget, e.target, ['btn-state']),
            el = nodeData['node'],
            prevEl = el.parentElement.querySelector('.active'),
            state = el.dataset.state;

        this.deactivateButton(prevEl);
        this.activateButton(el);

        this.config.setState(state);
        this.fire('changestate');
    },

    changeDefaultFade: function(e) {
        var nodeData = this.nodeChainContainsClassName(e.currentTarget, e.target, ['btn-fade']),
            el = nodeData['node'],
            prevEl = el.parentElement.querySelector('.active'),
            type = el.dataset.fade;

        this.deactivateButton(prevEl);
        this.activateButton(el);

        this.config.setFadeType(type);
    },

    trimAudio: function(e) {
        var el = e.target,
            disabled,
            classes = this.classes;

        disabled = el.classList.contains(classes["disabled"]);

        if (!disabled) {
            this.fire('trackedit', {
                type: "trimAudio"
            });
        }  
    },

    createFade: function(e) {
        var el = e.target,
            shape = el.dataset.shape,
            type = el.dataset.type,
            disabled,
            classes = this.classes;

        disabled = el.classList.contains(classes["disabled"]);

        if (!disabled) {
            this.fire('trackedit', {
                type: "createFade",
                args: {
                    type: type, 
                    shape: shape
                }
            });
        }  
    },

    onAudioSelection: function() {
        this.activateAudioSelection();
    },

    onAudioDeselection: function() {
        this.deactivateAudioSelection();
    },

    /*
        start, end in seconds
    */
    notifySelectionUpdate: function(start, end) {
        this.fire('changeselection', {
            start: start,
            end: end
        });
    },

    /*
        start, end in seconds
    */
    onCursorSelection: function(args) {
        var startFormat = this.cueFormatters(this.timeFormat)(args.start),
            endFormat = this.cueFormatters(this.timeFormat)(args.end),
            start = this.cueToSeconds(startFormat),
            end = this.cueToSeconds(endFormat);

        this.currentSelectionValues = {
            start: start,
            end:end
        };

        if (this.ctrls["audio-start"]) {
            this.ctrls["audio-start"].value = startFormat;
        }

        if (this.ctrls["audio-end"]) {
            this.ctrls["audio-end"].value = endFormat;
        }
    },

    /*
        args {seconds, pixels}
    */
    onAudioUpdate: function(args) {
        if (this.ctrls["audio-pos"]) {
            this.ctrls["audio-pos"].innerHTML = this.cueFormatters(this.timeFormat)(args.seconds);
        } 
    }
};

'use strict';

WaveformPlaylist.fades = {
   
    sCurveFadeIn: function sCurveFadeIn(gain, start, duration, options) {
        var curve;
            
        curve = this.createSCurveBuffer(this.sampleRate, (Math.PI/2));
        gain.setValueCurveAtTime(curve, start, duration);
    },

    sCurveFadeOut: function sCurveFadeOut(gain, start, duration, options) {
        var curve;
            
        curve = this.createSCurveBuffer(this.sampleRate, -(Math.PI/2));
        gain.setValueCurveAtTime(curve, start, duration);
    },

    linearFadeIn: function linearFadeIn(gain, start, duration, options) {

        gain.linearRampToValueAtTime(0, start);
        gain.linearRampToValueAtTime(1, start + duration);
    },

    linearFadeOut: function linearFadeOut(gain, start, duration, options) {

        gain.linearRampToValueAtTime(1, start);
        gain.linearRampToValueAtTime(0, start + duration);
    },

    exponentialFadeIn: function exponentialFadeIn(gain, start, duration, options) {

        gain.exponentialRampToValueAtTime(0.01, start);
        gain.exponentialRampToValueAtTime(1, start + duration);
    },

    exponentialFadeOut: function exponentialFadeOut(gain, start, duration, options) {

        gain.exponentialRampToValueAtTime(1, start);
        gain.exponentialRampToValueAtTime(0.01, start + duration);
    },

    logarithmicFadeIn: function logarithmicFadeIn(gain, start, duration, options) {
        var curve,
            base = options.base;

        base = typeof base !== 'undefined' ? base : 10;

        curve = this.createLogarithmicBuffer(this.sampleRate, base, 1);
        gain.setValueCurveAtTime(curve, start, duration);
    },

    logarithmicFadeOut: function logarithmicFadeOut(gain, start, duration, options) {
        var curve,
            base = options.base;

        base = typeof base !== 'undefined' ? base : 10;

        curve = this.createLogarithmicBuffer(this.sampleRate, base, -1);
        gain.setValueCurveAtTime(curve, start, duration);
    },

    /**
        Calls the appropriate fade type with options

        options {
            start,
            duration,
            base (for logarithmic)
        }
    */
    createFadeIn: function createFadeIn(gain, type, options) {
        var method = type + "FadeIn",
            fn = this[method];

        fn.call(this, gain, options.start, options.duration, options);
    },

    createFadeOut: function createFadeOut(gain, type, options) {
        var method = type + "FadeOut",
            fn = this[method];

        fn.call(this, gain, options.start, options.duration, options);
    }
};

WaveformPlaylist.mixin(WaveformPlaylist.fades, WaveformPlaylist.curves);

'use strict';

WaveformPlaylist.Storage = {

	save: function save(name, playlist) {
		var json = JSON.stringify(playlist);

		localStorage.setItem(name, json);
	},

	restore: function restore(name) {
		var JSONstring = localStorage.getItem(name),
				data;

		data = JSON.parse(JSONstring);

		return data;
	}
};

'use strict';

WaveformPlaylist.AudioPlayout = {

    init: function() {
        this.ac = this.config.getAudioContext();

        this.fadeMaker = Object.create(WaveformPlaylist.fades, {
            sampleRate: {
                value: this.ac.sampleRate
            }
        });

        this.gain = 1;
        this.destination = this.ac.destination;
    },

    getBuffer: function() {
        return this.buffer;
    },

    /*
        param relPos: cursor position in seconds relative to this track.
            can be negative if the cursor is placed before the start of this track etc.
    */
    applyFades: function(fades, relPos, now) {
        var id,
            fade,
            fn,
            options,
            startTime,
            duration;

        //loop through each fade on this track
        for (id in fades) {

            fade = fades[id];

            //skip fade if it's behind the cursor.
            if (relPos >= fade.end) {
                continue;
            }

            if (relPos <= fade.start) {
                startTime = now + (fade.start - relPos);
                duration = fade.end - fade.start;
            }
            else if (relPos > fade.start && relPos < fade.end) {
                startTime = now - (relPos - fade.start);
                duration = fade.end - fade.start;
            }

            options = {
                start: startTime,
                duration: duration
            };

            if (fades.hasOwnProperty(id)) {
                fn = this.fadeMaker["create"+fade.type];
                fn.call(this.fadeMaker, this.fadeGain.gain, fade.shape, options);
            }
        }
    },

    /**
     * Loads audiobuffer.
     *
     * @param {AudioBuffer} audioData Audio data.
     */
    loadData: function (audioData, cb) {
        var that = this;

        this.ac.decodeAudioData(
            audioData,
            function (buffer) {
                that.buffer = buffer;
                cb(buffer);
            },
            function(err) { 
                console.log("err(decodeAudioData): "+err);
                cb(null, err);
            }
        );
    },

    isPlaying: function() {
        return this.source !== undefined;
    },

    getDuration: function() {
        return this.buffer.duration;
    },

    setUpSource: function() {
        var sourcePromise;
        var that = this;

        this.source = this.ac.createBufferSource();
        this.source.buffer = this.buffer;

        sourcePromise = new Promise(function(resolve, reject) {
            //keep track of the buffer state.
            that.source.onended = function(e) {
                that.source.disconnect();
                that.fadeGain.disconnect();
                that.outputGain.disconnect();
                that.masterGain.disconnect();

                that.source = undefined;
                that.fadeGain = undefined;
                that.outputGain = undefined;
                that.masterGain = undefined;

                resolve();
            }
        });

        this.fadeGain = this.ac.createGain();
        //used for track volume slider
        this.outputGain = this.ac.createGain();
        //used for solo/mute
        this.masterGain = this.ac.createGain();

        this.source.connect(this.fadeGain);
        this.fadeGain.connect(this.outputGain);
        this.outputGain.connect(this.masterGain);
        this.masterGain.connect(this.destination);

        return sourcePromise;
    },

    setGainLevel: function(gain) {
        this.outputGain && (this.outputGain.gain.value = gain);
    },

    setMasterGainLevel: function(gain) {
        this.masterGain && (this.masterGain.gain.value = gain);
    },

    /*
        source.start is picky when passing the end time. 
        If rounding error causes a number to make the source think 
        it is playing slightly more samples than it has it won't play at all.
        Unfortunately it doesn't seem to work if you just give it a start time.
    */
    play: function(when, start, duration) {
        this.source.start(when || 0, start, duration);
    },

    stop: function(when) {
        this.source && this.source.stop(when || 0);
    }
};

'use strict';

WaveformPlaylist.TimeScale = {

    init: function() {
        var that = this,
            canv,
            div,
            resizeTimer,
            controlSettings = this.config.getControlSettings();

        this.timeinfo = {
            20000: {
                marker: 30000,
                bigStep: 10000,
                smallStep: 5000,
                secondStep: 5
            },
            12000: {
                marker: 15000,
                bigStep: 5000,
                smallStep: 1000,
                secondStep: 1
            },
            10000: {
                marker: 10000,
                bigStep: 5000,
                smallStep: 1000,
                secondStep: 1
            },
            5000: {
                marker: 5000,
                bigStep: 1000,
                smallStep: 500,
                secondStep: 1/2
            },
            2500: {
                marker: 2000,
                bigStep: 1000,
                smallStep: 500,
                secondStep: 1/2
            },
            1500: {
                marker: 2000,
                bigStep: 1000,
                smallStep: 200,
                secondStep: 1/5
            },
            700: {
                marker: 1000,
                bigStep: 500,
                smallStep: 100,
                secondStep: 1/10
            }
        };

        WaveformPlaylist.makePublisher(this);

        div = document.querySelector(".playlist-time-scale");
        div.style.position = "relative";
        div.style.left = 0;
        div.style.right = 0;

        if (controlSettings.show) {
            div.style.marginLeft = controlSettings.width+"px";
        }

        if (div === undefined) {
            return;
        }
        
        canv = document.createElement("canvas");
        this.canv = canv;
        this.context = canv.getContext('2d');
        this.container = div; //container for the main time scale.

        //TODO check for window resizes to set these.
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;

        canv.setAttribute('width', this.width);
        canv.setAttribute('height', this.height);
        canv.style.position = "absolute";
        canv.style.left = 0;
        canv.style.right = 0;
        canv.style.top = 0;
        canv.style.bottom = 0;

        //array of divs displaying time every 30 seconds. (TODO should make this depend on resolution)
        this.times = [];

        this.prevScrollPos = 0; //checking the horizontal scroll (must update timeline above in case of change)

        //TODO check scroll adjust.
        function doneResizing() {
            that.width = that.container.clientWidth;
            that.height = that.container.clientHeight;

            canv.setAttribute('width', that.width);
            canv.setAttribute('height', that.height);

            that.drawScale();
        };

        function onResize() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(doneResizing, 100);
        };

        this.onResize = onResize;

        this.drawScale();
    },

    getScaleInfo: function(resolution) {
        var keys, i, end;

        keys = Object.keys(this.timeinfo).map(function(item) {
            return parseInt(item, 10);
        });

        //make sure keys are numerically sorted.
        keys = keys.sort(function(a, b){return a - b});

        for (i = 0, end = keys.length; i < end; i++) {
           if (resolution <= keys[i]) {
                return this.timeinfo[keys[i]];
            } 
        }
    },

    /*
        Return time in format mm:ss
    */
    formatTime: function(milliseconds) {
        var out, m, s, seconds;

        seconds = milliseconds/1000;

        s = seconds % 60;
        m = (seconds - s) / 60;

        if (s < 10) {
            s = "0"+s;
        }

        out = m + ":" + s;

        return out;
    },

    clear: function() {
       
        this.container.innerHTML = "";
        this.context.clearRect(0, 0, this.width, this.height);
    },

    drawScale: function(offset) {
        var cc = this.context,
            colors = this.config.getColorScheme(),
            pix,
            res = this.config.getResolution(),
            SR = this.config.getSampleRate(),
            pixPerSec = SR/res,
            pixOffset = offset || 0, //caused by scrolling horizontally
            i,
            end,
            counter = 0,
            pixIndex,
            div,
            time,
            sTime,
            fragment = document.createDocumentFragment(),
            scaleY,
            scaleHeight,
            scaleInfo = this.getScaleInfo(res);

        this.clear();

        fragment.appendChild(this.canv);
        cc.fillStyle = colors.timeColor;
        end = this.width + pixOffset;

        for (i = 0; i < end; i = i + pixPerSec*scaleInfo.secondStep) {

            pixIndex = ~~(i);
            pix = pixIndex - pixOffset;

            if (pixIndex >= pixOffset) {

                //put a timestamp every 30 seconds.
                if (scaleInfo.marker && (counter % scaleInfo.marker === 0)) {

                    sTime = this.formatTime(counter);
                    time = document.createTextNode(sTime);
                    div = document.createElement("div");
            
                    div.style.position = "absolute";
                    div.style.left = pix+"px";
                    div.appendChild(time);
                    fragment.appendChild(div);

                    scaleHeight = 10;
                }
                else if (scaleInfo.bigStep && (counter % scaleInfo.bigStep === 0)) {
                    scaleHeight = 5;
                }
                else if (scaleInfo.smallStep && (counter % scaleInfo.smallStep === 0)) {
                    scaleHeight = 2;
                }

                scaleY = this.height - scaleHeight;
                cc.fillRect(pix, scaleY, 1, scaleHeight);
            }

            counter += 1000*scaleInfo.secondStep;  
        }

        this.container.appendChild(fragment);
    },

    onTrackScroll: function(scrollX, scrollY) {
        if (scrollX !== this.prevScrollPos) {
            this.prevScrollPos = scrollX;
            this.drawScale(scrollX);
        }
    },

    onResolutionChange: function() {
        var scroll = this.config.getTrackScroll(),
            scrollX = scroll.left;    

        this.drawScale(scrollX);
    }
};

'use strict';

WaveformPlaylist.TrackEditor = {

    init: function(src, start, end, fades, cues, stateConfig) {

        var statesEnabled = {
            'cursor': true,
            'fadein': true,
            'fadeout': true,
            'select': true,
            'shift': true,
            'fileDrop': true
        };

        stateConfig = stateConfig || {};

        //extend enabled states config.
        Object.keys(statesEnabled).forEach(function (key) {
            statesEnabled[key] = (key in stateConfig) ? stateConfig[key] : statesEnabled[key];
        });

        this.enabledStates = statesEnabled;
       
        WaveformPlaylist.makePublisher(this);

        this.playout = Object.create(WaveformPlaylist.AudioPlayout, {
            config: {
                value: this.config
            }
        });
        this.playout.init();

        this.sampleRate = this.config.getSampleRate();
        this.resolution = this.config.getResolution();

        //value is a float in seconds
        this.startTime = start || 0;
        //value is a float in seconds
        this.endTime = end || 0; //set properly in onTrackLoad.

        this.fades = {};
        if (fades !== undefined && fades.length > 0) {
        
            for (var i = 0; i < fades.length; i++) {
                this.fades[this.getFadeId()] = fades[i];
            }
        }

        if (cues !== undefined) {
            this.cuein = cues.cuein;
            this.cueout = cues.cueout;
        }
        
        this.active = false;
        this.gain = 1;
        //selected area stored in seconds relative to entire playlist.
        this.selectedArea = undefined;

        this.drawer = Object.create(WaveformPlaylist.WaveformDrawer, {
            config: {
                value: this.config
            }
        });

        this.container = this.drawer.init();

        return this.container;
    },

    //value leftOffset is measured in samples.
    setLeftOffset: function(offset) {
        this.leftOffset = offset;
        this.drawer.setPixelOffset(offset / this.resolution);

        this.fire('changeshift');
    },

    getFadeId: function() {
        var id = ""+Math.random();

        return id.replace(".", "");
    },

    getBuffer: function() {
        return this.playout.getBuffer();
    },

    /*
    *   Completes track load from a passed in url.
    */
    loadTrack: function(track) {
        var el;

        el = this.init(
            track.src, 
            track.start, 
            track.end, 
            track.fades,
            {
                cuein: track.cuein,
                cueout: track.cueout
            },
            track.states
        );

        if (track.selected !== undefined) {
            this.selectedArea = {
                startTime: track.selected.start,
                endTime: track.selected.end
            };
        }

        this.drawer.drawLoading();
        this.loadBuffer(track.src);

        return el;
    },

    fileProgress: function(e) {
        var percentComplete;

        if (e.lengthComputable) {
            percentComplete = e.loaded / e.total * 100;
            this.drawer.updateLoader(percentComplete);
        }
    },

    fileLoad: function(e) {
        var that = this;
        this.drawer.setLoaderState("decoding");

        this.playout.loadData(
            e.target.response || e.target.result,
            that.onTrackLoad.bind(that)
        );
    },

    /**
     * Loads an audio file via XHR.
     */
    loadBuffer: function(src) {
        var that = this,
            xhr = new XMLHttpRequest();

        this.filename = src.replace(/^.*[\\\/]/, '');
        this.src = src;

        xhr.open('GET', src, true);
        xhr.responseType = 'arraybuffer';

        xhr.addEventListener('progress', this.fileProgress.bind(this));
        xhr.addEventListener('load', this.fileLoad.bind(this));
        xhr.send();
    },

    /*
    * Loads an audio file vie a FileReader
    */
    loadBlob: function(file) {
        if (file.type.match(/audio.*/)) {
            var dr = new FileReader();
            var fr = new FileReader();
            var track = this;

            this.filename = file.name;
            this.drawer.drawLoading();

            dr.addEventListener('load', function() {
                track.src = dr.result;
            });

            fr.addEventListener('progress', this.fileProgress.bind(this));
            fr.addEventListener('load', this.fileLoad.bind(this));

            fr.addEventListener('error', function () {
                console.error('error loading file ' + this.filename);
            });

            dr.readAsDataURL(file);
            fr.readAsArrayBuffer(file);
        }
    },

    drawTrack: function(buffer) {
        this.drawer.drawWaveform(buffer, this.cues, this.fades);
    },

    onTrackLoad: function(buffer, err) {
        var res,
            startTime,
            endTime,
            cuein,
            cueout;

        if (err !== undefined) {
            this.drawer.drawError();
            this.fire('error', this);
            return;
        }

        //placed here to make sure container events are added.
        this.fire('trackloaded', this);

        cuein = (this.cuein && this.secondsToSamples(this.cuein)) || 0;
        cueout = (this.cueout && this.secondsToSamples(this.cueout)) || buffer.length;

        this.setCuePoints(cuein, cueout);

        this.drawer.drawContainer(buffer, this.cues, this.fades, this.filename);
        this.setLeftOffset(this.secondsToSamples(this.startTime));
        this.setState(this.config.getState());

        if (this.selectedArea !== undefined) {
            startTime = this.selectedArea.startTime;
            endTime = this.selectedArea.endTime;

            this.showSelection();
            this.notifySelectUpdate(startTime, endTime);
        }
    },

    activate: function() {
        this.active = true;
        this.drawer.drawActive();
    },

    deactivate: function() {
        this.active = false;
        this.drawer.drawInactive();
        
        if (this.selectedArea) {
            this.selectedArea = undefined;
        }
    },

    /*
        startTime, endTime in seconds.
    */
    notifySelectUpdate: function(startTime, endTime, shiftKey) {
        this.fire('changecursor', {
            start: startTime,
            end: endTime,
            shiftKey: shiftKey,
            editor: this
        });
    },

    /*
        start, end in seconds
    */
    setSelectedArea: function(start, end, shiftKey) {
        //extending selected area since shift is pressed on a single point click.
        if (shiftKey && (start === end) && (this.prevSelectedArea !== undefined)) {

            if (start >= this.prevSelectedArea.endTime) {
                start = this.prevSelectedArea.startTime;
            }
            else if (start <= this.prevSelectedArea.startTime ) {
                end = this.prevSelectedArea.endTime;
            }

        }

        this.prevSelectedArea = this.selectedArea;
        this.selectedArea = {
            startTime: start,
            endTime: end
        };

        this.config.setCursorPos(start);
        this.showSelection();

        if (start < end) {
            this.activateAudioSelection();
        }
        else {
            this.deactivateAudioSelection();
        }
    },

    activateAudioSelection: function() {

        this.fire("activateSelection");
    },

    deactivateAudioSelection: function() {

        this.fire("deactivateSelection");
    },

    saveFade: function(id, type, shape, start, end) {
        
        this.fades[id] = {
            type: type,
            shape: shape,
            start: start,
            end: end
        };

        return id;
    },

    removeFade: function(id) {

        delete this.fades[id];
        this.drawer.removeFade(id);
    },

    removeFadeType: function(type) {
        var id,
            fades = this.fades,
            fade;

        for (id in fades) {
            fade = fades[id];

            if (fade.type === type) {
                this.removeFade(id);
            }
        }
    },

    /*
        Cue points are stored internally in the editor as sample indices for highest precision.

        sample at index cueout is not included.
    */
    setCuePoints: function(cuein, cueout) {
        //need the offset for trimming an already trimmed track.
        var offset = this.cues ? this.cues.cuein : 0,
            buffer = this.getBuffer(),
            cutOff = this.cues ? this.cues.cueout : buffer.length;

        if (cuein < 0) {
            cuein = 0;
        }
        //adjust if the length was inaccurate and cueout is set to a higher sample than we actually have.
        if ((offset + cueout) > cutOff) {
            cueout = cutOff - offset;
        }

        this.cues = {
            cuein: offset + cuein,
            cueout: offset + cueout
        };

        this.duration = (cueout - cuein) / this.sampleRate;
        this.endTime = this.duration + this.startTime;
        this.cuein = this.samplesToSeconds(this.cues.cuein);
        this.cueout = this.samplesToSeconds(this.cues.cueout);
    },

    /*
        Will remove all audio samples from the track's buffer except for the currently selected area.
        Used to set cuein / cueout points in the audio.
    */
    trim: function() {
        var selected = this.selectedArea,
            sampleStart,
            sampleEnd;

        if (selected === undefined) {
            return;
        }

        sampleStart = this.secondsToSamples(selected.startTime) - this.leftOffset;
        //add one sample since last one is exclusive.
        sampleEnd = this.secondsToSamples(selected.endTime) - this.leftOffset + 1;
        
        this.setCuePoints(sampleStart, sampleEnd);
        this.notifySelectUpdate(0, 0);
        this.fades = {};
        this.drawTrack(this.getBuffer());
    },

    onTrackEdit: function(event) {
        var type = event.type,
            method = "on" + type.charAt(0).toUpperCase() + type.slice(1);

        if (this.active === true) {
            this[method].call(this, event.args);
        }
    },

    /*
        start, end are in pixels relative to the track.
    */
    createFade: function(type, shape, start, end) {
        var selected = this.selectedArea,
            startTime = this.pixelsToSeconds(start),
            endTime = this.pixelsToSeconds(end),
            id = this.getFadeId();

        this.notifySelectUpdate(0, 0);
        this.saveFade(id, type, shape, startTime, endTime);
        this.drawer.drawFade(id, type, shape, start, end);
    },

    onCreateFade: function(args) {
        this.createFade(args.type, args.shape);
        this.deactivateAudioSelection();
    },

    onTrimAudio: function() {
        var selected = this.selectedArea;

        this.trim(selected.start, selected.end);
        this.deactivateAudioSelection();
    },

    setState: function(state) {
        //leave the past state if it was enabled
        this.currentState && this.currentState.leave.call(this);

        if (this.enabledStates[state]) {
            this.currentState = WaveformPlaylist.states[state];
            this.currentState.enter.call(this);
        }
    },

    onResolutionChange: function(res) {
        var selected = this.selectedArea;

        this.resolution = res;
        this.drawTrack(this.getBuffer());
        this.drawer.setPixelOffset(this.leftOffset / res);

        if (this.active === true && this.selectedArea !== undefined) {
            
            this.drawer.drawHighlight(this.secondsToPixels(selected.startTime), this.secondsToPixels(selected.endTime));
        }

        this.fire('changeshift');
    },

    isPlaying: function() {
        return this.playout.isPlaying();
    },

    setGainLevel: function(gain) {
        this.gain = gain;
        this.playout.setGainLevel(gain);
    },

    setMasterGainLevel: function(gain) {
        this.playout.setMasterGainLevel(gain);

        if (gain) {
            this.container.classList.remove('silent');
        }
        else {
            this.container.classList.add('silent');
        }
    },

    /*
        startTime, endTime in seconds (float).
        segment is for a highlighted section in the UI.

        returns a Promise that will resolve when the AudioBufferSource
        is either stopped or plays out naturally.
    */
    schedulePlay: function(now, startTime, endTime, options) { 
        var start,
            duration,
            relPos,
            when = now,
            segment = (endTime) ? (endTime - startTime) : undefined,
            cueOffset = this.cues.cuein / this.sampleRate,
            sourcePromise;

        //1) track has no content to play.
        //2) track does not play in this selection.
        if ((this.endTime <= startTime) || (segment && (startTime + segment) < this.startTime)) {
            //return a resolved promise since this track is technically "stopped".
            return Promise.resolve();
        }

        //track should have something to play if it gets here.

        //the track starts in the future or on the cursor position
        if (this.startTime >= startTime) {
            start = 0;
            when = when + this.startTime - startTime; //schedule additional delay for this audio node.

            if (endTime) {
                segment = segment - (this.startTime - startTime);
                duration = Math.min(segment, this.duration);
            }
            else {
                duration = this.duration;
            }
        }
        else {
            start = startTime - this.startTime;

            if (endTime) {
                duration = Math.min(segment, this.duration - start);
            }
            else {
                duration = this.duration - start;
            }
        }

        start = start + cueOffset;
        relPos = startTime - this.startTime;

        sourcePromise = this.playout.setUpSource();
        this.playout.applyFades(this.fades, relPos, now);
        this.playout.setGainLevel(this.gain);
        this.playout.setMasterGainLevel(options.masterGain);
        this.playout.play(when, start, duration);

        return sourcePromise;
    },

    scheduleStop: function(when) {
        this.playout.stop(when || this.config.getCurrentTime());
    },

    /*
        cursorPos in seconds
    */
    showProgress: function(cursorPos) {
        this.drawer.updateProgress(this.secondsToPixels(cursorPos));
    },

    showSelection: function() {
        var start,
            end;

        start = this.secondsToPixels(this.selectedArea.startTime);
        end = this.secondsToPixels(this.selectedArea.endTime);

        //these pixels are relative to the playlist
        this.drawer.drawHighlight(start, end);
    },

    getTrackDetails: function() {
        var d,
            cues = this.cues,
            fades = [],
            id;

        for (id in this.fades) {
            fades.push(this.fades[id]);
        }

        d = {
            start: this.startTime,
            end: this.endTime,
            fades: fades,
            src: this.src,
            cuein: this.samplesToSeconds(cues.cuein),
            cueout: this.samplesToSeconds(cues.cueout)
        };

        return d;
    },

    destroy: function() {
        //remove events attached to the waveform
        this.currentState && this.currentState.leave.call(this);
    }
};

WaveformPlaylist.mixin(WaveformPlaylist.TrackEditor, WaveformPlaylist.unitConversions);

'use strict';

WaveformPlaylist.WaveformDrawer = {

    MAX_CANVAS_WIDTH: 20000,

    init: function() {

        WaveformPlaylist.makePublisher(this);

        this.container = document.createElement("div");
        this.container.classList.add("channel-wrapper");

        this.channels = []; //array of canvases, contexts, 1 for each channel displayed.
        this.pixelOffset = 0;
        this.containerWidth = 0;

        var theme = this.config.getUITheme();

        if (this.loaderStates[theme] !== undefined) {
            this.loaderStates = this.loaderStates[theme];
        }
        else {
            this.loaderStates = this.loaderStates["default"];
        }

        return this.container;
    },

    loaderStates: {
        "bootstrap": {
            "downloading": "progress-bar",
            "decoding": "progress-bar progress-bar-striped",
            "loader": "bar"
        },
        
        "jQueryUI": {
            "downloading": "ui-progressbar ui-widget ui-widget-content ui-corner-all",
            "decoding": "ui-progressbar ui-widget ui-widget-content ui-corner-all",
            "loader": "ui-progressbar-value ui-widget-header ui-corner-left"
        },

        "default": {
            "downloading": "progress",
            "decoding": "decoding",
            "loader": "bar"
        }
    },

    getPeaks: function(buffer, cues) {
        
        // Frames per pixel
        var res = this.config.getResolution(),
            peaks = [],
            i, c, p, l,
            chanLength = cues.cueout - cues.cuein,
            pixels = Math.ceil(chanLength / res),
            numChan = buffer.numberOfChannels,
            weight = 1 / (numChan),
            makeMono = this.config.isDisplayMono(),
            chan, 
            start, 
            end, 
            vals, 
            max, 
            min,
            maxPeak = -Infinity; //used to scale the waveform on the canvas.

        for (i = 0; i < pixels; i++) {
            
            peaks[i] = [];

            for (c = 0; c < numChan; c++) {

                chan = buffer.getChannelData(c);
                chan = chan.subarray(cues.cuein, cues.cueout);

                start = i * res;
                end = (i + 1) * res > chanLength ? chanLength : (i + 1) * res;
                vals = chan.subarray(start, end);
                max = -Infinity;
                min = Infinity;

                for (p = 0, l = vals.length; p < l; p++) {
                    if (vals[p] > max){
                        max = vals[p];
                    }
                    if (vals[p] < min){
                        min = vals[p];
                    }
                }
                peaks[i].push({max:max, min:min});
                maxPeak = Math.max.apply(Math, [maxPeak, Math.abs(max), Math.abs(min)]);
            }
        
            if (makeMono) {
                max = min = 0;

                for (c = 0 ; c < numChan; c++) {
                    max = max + weight * peaks[i][c].max;
                    min = min + weight * peaks[i][c].min;     
                }

                peaks[i] = []; //need to clear out old stuff (maybe we should keep it for toggling views?).
                peaks[i].push({max:max, min:min});
            }
        }

        this.maxPeak = maxPeak;
        this.peaks = peaks;
    },

    drawError: function() {
        this.container.innerHTML = "";
        this.container.classList.add("error");
    },

    drawActive: function() {
        this.container.classList.add("active");
    },

    drawInactive: function() {
        this.container.classList.remove("active");
        this.selection && this.waveformContainer.removeChild(this.selection);
        this.selection = undefined;
    },

    setPixelOffset: function(pixels) {
        var containerWidth = pixels + this.width;

        this.pixelOffset = pixels;
        this.drawTimeShift();

        //minimum width in pixels required by this waveform
        this.containerWidth = pixels + this.width;
    },

    drawTimeShift: function() {
        var i, len;

        for (i = 0, len = this.channels.length; i < len; i++) {
            this.channels[i].div.style.left = this.pixelOffset+"px";
        } 
    },

    updateLoader: function(percent) {
        this.loader.style.width = percent+"%";
    },

    setLoaderState: function(state) {
        this.loader.className = this.loaderStates[state];
    },

    drawLoading: function() {
        var div,
            loader;

        this.height = this.config.getWaveHeight();

        div = document.createElement("div");
        div.style.height = this.height+"px";
        
        loader = document.createElement("div");
        loader.style.height = "10px";
        loader.className = this.loaderStates["loader"];

        div.appendChild(loader);
        this.loader = loader;

        this.setLoaderState("downloading");
        this.updateLoader(0);

        this.container.appendChild(div);
    },

    /*
    * width - pixels.
    */
    updateContainerWidth: function(width) {
        this.container.style.width = width+'px';
        //this function can still be called while track is loading.
        this.waveformContainer && (this.waveformContainer.style.width = width+'px');
    },

    /*
        Returns a pixel clicked on this track relative to the entire playlist.
    */
    findClickedPixel: function(e) {
        var target = e.target,
            layerOffset = 0,
            canvasOffset = 0,
            parent,
            startX = e.layerX || e.offsetX;

        //need to find the canvas offset
        if (target.tagName === "CANVAS") {
            //If canvas selected must add left offset to layerX
            //this will be an offset relative to the entire playlist.
            parent = target.parentNode;
            layerOffset = parent.offsetLeft;

            //need to add the offset of the channel wrapper as well.
            if (parent.classList.contains('playlist-fade')) {
                parent = parent.parentNode;
                layerOffset += parent.offsetLeft;
            }
            else {
                canvasOffset = target.dataset.offset;
            }

        }
        else {
            //selection div may even throw us off.
            if (target.classList.contains('selection')) {
                layerOffset += target.offsetLeft;
            }
        }

        return layerOffset + startX + (canvasOffset * this.MAX_CANVAS_WIDTH);
    },

    drawTrackControls: function(width, height, filename) {
        var controls,
            btnGroup,
            muteButton,
            soloButton,
            volumeInput,
            label,
            name;

        controls = document.createElement("div");
        controls.style.height = height+"px";
        controls.style.width = width+"px";
        controls.style.position = "absolute";
        controls.style.left = 0;
        controls.classList.add("controls");
        controls.style.zIndex = 1000;

        name = document.createElement("header");
        name.textContent = filename;

        btnGroup = document.createElement("div");
        btnGroup.className = "btn-group";

        muteButton = document.createElement("span");
        muteButton.className = "btn btn-default btn-xs btn-mute";
        muteButton.textContent = "Mute";

        soloButton = document.createElement("span");
        soloButton.className = "btn btn-default btn-xs btn-solo";
        soloButton.textContent = "Solo";

        volumeInput = document.createElement("input");
        volumeInput.type = "range";
        volumeInput.setAttribute('min', 0);
        volumeInput.setAttribute('max', 100);
        volumeInput.setAttribute('value', 100);
        volumeInput.classList.add("volume-slider");

        label = document.createElement("label");
        label.appendChild(volumeInput);

        btnGroup.appendChild(muteButton);
        btnGroup.appendChild(soloButton);
        controls.appendChild(name);
        controls.appendChild(btnGroup);
        controls.appendChild(label);
        this.container.style.marginLeft = width+"px";

        return controls;
    },

    drawWaveform: function(buffer, cues, fades) {
        var canv,
            div,
            progress,
            i,
            top = 0,
            left = 0,
            makeMono = this.config.isDisplayMono(),
            res = this.config.getResolution(),
            numChan = makeMono? 1 : buffer.numberOfChannels,
            numSamples = cues.cueout - cues.cuein + 1,
            fragment = document.createDocumentFragment(),
            canvases,
            width,
            tmpWidth,
            canvasOffset,
            cursor;

        this.waveformContainer.innerHTML = ""; 
        this.channels = []; 
        this.selection = undefined;
        //width and height is per waveform canvas.
        this.width = Math.ceil(numSamples / res);

        cursor = document.createElement("div");
        cursor.classList.add("cursor");
        cursor.style.position = "absolute";
        cursor.style.boxSizing = "content-box";
        cursor.style.margin = 0;
        cursor.style.padding = 0;
        cursor.style.top = 0;
        cursor.style.left = 0;
        cursor.style.bottom = 0;
        cursor.style.zIndex = 100;

        this.cursor = cursor;

        fragment.appendChild(cursor);

        //create elements for each audio channel
        for (i = 0; i < numChan; i++) {

            //main container for this channel
            div = document.createElement("div");
            div.classList.add("channel");
            div.classList.add("channel-"+i);
            div.style.width = this.width+"px";
            div.style.height = this.height+"px";
            div.style.top = top+"px";
            div.style.left = left+"px";
            div.style.position = "absolute";
            div.style.margin = 0;
            div.style.padding = 0;
            div.style.zIndex = 1;

            //shows playback progress
            progress = document.createElement("div");
            progress.classList.add("channel-progress");
            progress.style.position = "absolute";
            progress.style.width = 0;
            progress.style.height = this.height+"px";
            progress.style.zIndex = 2;
            div.appendChild(progress);


            width = 0;
            canvases = [];
            canvasOffset = 0;

            //might need to draw the track over multiple canvases as per memory limits.
            while (width < this.width) {
                tmpWidth = Math.min(this.MAX_CANVAS_WIDTH, this.width - width);
                //canvas with the waveform drawn
                canv = document.createElement("canvas");
                canv.setAttribute('width', tmpWidth);
                canv.setAttribute('height', this.height);
                canv.style.cssFloat = "left";
                canv.style.position = "relative";
                canv.style.margin = 0;
                canv.style.padding = 0;
                canv.style.zIndex = 3;
                canv.dataset.offset = canvasOffset;
                div.appendChild(canv);

                canvases.push(canv);
                width += tmpWidth;
                canvasOffset++;
            }

            this.channels.push({
                canvas: canvases,
                div: div,
                progress: progress
            });

            fragment.appendChild(div);
            top = top + this.height;
        }

        this.getPeaks(buffer, cues);
        this.draw();
        this.drawTimeShift();
        this.drawFades(fades);

        this.waveformContainer.appendChild(fragment);
    },

    drawContainer: function(buffer, cues, fades, filename) {
        var makeMono = this.config.isDisplayMono(),
            res = this.config.getResolution(),
            numChan = makeMono? 1 : buffer.numberOfChannels,
            numSamples = cues.cueout - cues.cuein + 1,
            fragment = document.createDocumentFragment(),
            wrapperHeight = numChan * this.height,
            waveformContainer,
            controlSettings = this.config.getControlSettings();

        //remove the loading stuff
        this.container.innerHTML = ""; 

        //width and height is per waveform canvas.
        this.width = Math.ceil(numSamples / res);

        if (controlSettings.show) {
            fragment.appendChild(this.drawTrackControls(controlSettings.width, wrapperHeight, filename));
        }
        
        waveformContainer = document.createElement("div");
        waveformContainer.classList.add("waveform");
        waveformContainer.style.height = wrapperHeight+"px";
        waveformContainer.style.width = this.width+"px";
        waveformContainer.style.position = "relative";

        this.waveformContainer = waveformContainer;

        this.drawWaveform(buffer, cues, fades);

        fragment.appendChild(waveformContainer);
        this.container.style.height = wrapperHeight+"px";
        this.container.appendChild(fragment);
    },

    drawFrame: function(chanNum, index, peak) {
        var x, max, min,
            h2 = this.height / 2,
            canvOffset = Math.floor(index/this.MAX_CANVAS_WIDTH),
            cc = this.channels[chanNum].canvas[canvOffset].getContext('2d'),
            colors = this.config.getColorScheme();

        max = Math.abs(peak.max * h2);
        min = Math.abs(peak.min * h2);

        x = index - canvOffset*this.MAX_CANVAS_WIDTH;
        cc.fillStyle = colors.waveOutlineColor;

        //draw maxs
        cc.fillRect(x, 0, 1, h2-max);
        //draw mins
        cc.fillRect(x, h2+min, 1, h2-min);
    },

    /*
        start, end are optional parameters to only redraw part of the canvas.
    */
    draw: function(start, end) {
        var that = this,
            peaks = this.peaks,
            pixelOffset = this.pixelOffset,
            i = (start) ? start - pixelOffset : 0,
            len = (end) ? end - pixelOffset + 1 : peaks.length;

        if (i < 0 && len < 0) {
            return;
        } 

        if (i < 0) {
            i = 0;
        }

        if (len > peaks.length) {
            len = peaks.length;
        }

        for (; i < len; i++) {

            peaks[i].forEach(function(peak, chanNum) {
                that.drawFrame(chanNum, i, peak);
            });
        } 
    },

    /*
        set width of progress box according to cursor position (in pixels).
    */
    updateProgress: function(cursorPos) {
        this.drawProgress(cursorPos);
        this.drawCursor(cursorPos);
    },

    drawProgress: function(cursorPos) {
        var i, len,
            currentWidth = Math.max(cursorPos - this.pixelOffset, 0),
            width = Math.min(currentWidth, this.width);

        for (i = 0, len = this.channels.length; i < len; i++) {
            this.channels[i].progress.style.width = width+"px";
        }
    },

    drawCursor: function(cursorPos) {
        this.cursor.style.width = cursorPos+"px";
    },

    /*
        start, end in pixels.
    */
    drawHighlight: function(start, end) {
        var width = end - start + 1,
            selectionClass,
            selection = this.selection || document.createElement("div");

        selectionClass = (width === 1) ? 'selection-cursor' : 'selection-segment';

        selection.className = "";
        selection.classList.add(selectionClass);
        selection.classList.add("selection");
        selection.style.position = "absolute";
        selection.style.width = width+"px";
        selection.style.bottom = 0;
        selection.style.top = 0;
        selection.style.left = start+"px";
        selection.style.zIndex = 999;

        if (this.selection === undefined) {
            this.waveformContainer.appendChild(selection);
            this.selection = selection;
        }
    },

    sCurveFadeIn: function sCurveFadeIn(width) {
        return this.createSCurveBuffer(width, (Math.PI/2));
    },

    sCurveFadeOut: function sCurveFadeOut(width) {
        return this.createSCurveBuffer(width, -(Math.PI/2));  
    },

    logarithmicFadeIn: function logarithmicFadeIn(width) {
        return this.createLogarithmicBuffer(width, 10, 1);
    },

    logarithmicFadeOut: function logarithmicFadeOut(width) {
        return this.createLogarithmicBuffer(width, 10, -1);  
    },

    exponentialFadeIn: function exponentialFadeIn(width) {
        return this.createExponentialBuffer(width, 1);
    },

    exponentialFadeOut: function exponentialFadeOut(width) {
        return this.createExponentialBuffer(width, -1);  
    },

    linearFadeIn: function linearFadeIn(width) {
        return this.createLinearBuffer(width, 1);
    },

    linearFadeOut: function linearFadeOut(width) {
        return this.createLinearBuffer(width, -1);  
    },

    drawFadeCurve: function(ctx, shape, type, width) {
        var method = shape+type,
            fn = this[method],
            colors = this.config.getColorScheme(),
            curve,
            i, len,
            cHeight = this.height,
            y;

        ctx.strokeStyle = colors.fadeColor;

        curve = fn.call(this, width);

        y = cHeight - curve[0] * cHeight;
        ctx.beginPath();
        ctx.moveTo(0, y);

        for (i = 1, len = curve.length; i < len; i++) {
            y = cHeight - curve[i] * cHeight;
            ctx.lineTo(i, y);
        }
        ctx.stroke();
    },

    removeFade: function(id) {
        var fadeClass = "playlist-fade-"+id,
            el, els,
            i,len;

        els = this.container.getElementsByClassName(fadeClass);
        len = els.length;

        //DOM NodeList is live, use a decrementing counter.
        if (len > 0) {
            for (i = len-1; i >= 0; i--) {
                el = els[i];
                el.parentNode.removeChild(el);
            }    
        }
    },

    drawFade: function(id, type, shape, start, end) {
        var div,
            canv,
            width,
            left,
            fragment = document.createDocumentFragment(),
            i, len,
            dup,
            ctx,
            tmpCtx;

        if ((end - start) === 0) {
            return;
        } 

        width = ~~(end - start + 1);
        left = start;

        div = document.createElement("div");
        div.classList.add("playlist-fade");
        div.classList.add("playlist-fade-"+id);
        div.style.position = "absolute";
        div.style.width = width+"px";
        div.style.height = this.height+"px";
        div.style.top = 0;
        div.style.left = left+"px";
        div.style.zIndex = 1000;

        canv = document.createElement("canvas");
        canv.setAttribute('width', width);
        canv.setAttribute('height', this.height);
        ctx = canv.getContext('2d');

        this.drawFadeCurve(ctx, shape, type, width);

        div.appendChild(canv);
        fragment.appendChild(div);   
          
        for (i = 0, len = this.channels.length; i < len; i++) {
            dup = fragment.cloneNode(true);
            tmpCtx = dup.querySelector('canvas').getContext('2d');
            tmpCtx.drawImage(canv, 0, 0);

            this.channels[i].div.appendChild(dup);
        }
    },

    drawFades: function(fades) {
        var id,
            fade,
            startPix,
            endPix,
            SR = this.config.getSampleRate(),
            res = this.config.getResolution();

        for (id in fades) {
            fade = fades[id];

            if (fades.hasOwnProperty(id)) {
                startPix = fade.start * SR / res;
                endPix = fade.end * SR / res;
                this.drawFade(id, fade.type, fade.shape, startPix, endPix);
            }
        }
    }
};

WaveformPlaylist.mixin(WaveformPlaylist.WaveformDrawer, WaveformPlaylist.curves);
