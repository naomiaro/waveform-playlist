/*! waveform-playlist 0.2.0
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

        WaveformPlaylist.makePublisher(this);

        this.storage = Object.create(WaveformPlaylist.Storage);

        container.style.overflow = "hidden";

        this.trackContainer = div;
        this.trackContainer.style.position = "relative";
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

            audioControls.on("trackedit", "onTrackEdit", trackEditor);
            audioControls.on("changeresolution", "onResolutionChange", trackEditor);

            trackEditor.on("activateSelection", "onAudioSelection", audioControls);
            trackEditor.on("deactivateSelection", "onAudioDeselection", audioControls);
            trackEditor.on("changecursor", "onCursorSelection", audioControls);
            trackEditor.on("changecursor", "onSelectUpdate", this);
            trackEditor.on("changeshift", "onChangeShift", this);

            trackEditor.on("unregister", (function() {
                var editor = this;

                audioControls.remove("trackedit", "onTrackEdit", editor);
                audioControls.remove("changeresolution", "onResolutionChange", editor);

                that.removeTrack(editor);

            }).bind(trackEditor));
        }

        this.trackContainer.appendChild(fragment);
        this.trackContainer.onscroll = this.onTrackScroll.bind(this);

        this.sampleRate = this.config.getSampleRate();
       
        this.scrollTimeout = false;

        //for requestAnimationFrame that's toggled during play/stop.
        this.animationRequest;
        this.animationCallback = this.updateEditor.bind(this);

        this.on("playbackcursor", "onAudioUpdate", audioControls);

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

        this.audioControls = audioControls;
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

    onStateChange: function() {
         var editors = this.trackEditors,
            i,
            len,
            state = this.config.getState();

        for (i = 0, len = editors.length; i < len; i++) {
            editors[i].deactivate();
            editors[i].setState(state);
        }
    },

    onTrackScroll: function() {
        var that = this;

        if (that.scrollTimeout) return;

        //limit the scroll firing to every 25ms.
        that.scrollTimeout = setTimeout(function() {
            
            that.config.setTrackScroll(that.trackContainer.scrollLeft, that.trackContainer.scrollTop);
            that.fire('trackscroll');
            that.scrollTimeout = false;
        }, 25);   
    },

    activateTrack: function(trackEditor) {
        var editors = this.trackEditors,
            i,
            len,
            editor;

        for (i = 0, len = editors.length; i < len; i++) {
            editor = editors[i];

            if (editor === trackEditor) {
                editor.activate();
                this.activeTrack = trackEditor;
            }
            else {
                editor.deactivate();
            }
        }
    },

    onSelectUpdate: function(event) {
        var editors = this.trackEditors,
            i,
            len;

        this.activateTrack(event.editor);

        //seeking while playing occuring
        if (this.isPlaying()) {
            this.stop();
            //need to allow time for all the onended callbacks to execute
            //TODO should maybe think of a better solution for this later...
            setTimeout(this.play.bind(this), 60);
        }

        //new cursor selected while paused.
        else if (this.pausedAt !== undefined) {
            this.pausedAt = undefined;

            for (i = 0, len = editors.length; i < len; i++) {
                editors[i].showProgress(0);
            }
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
            editors[i].drawer.container.style.width = maxTrackLengthPixels+'px';
        }

        this.duration = maxTrackLengthSeconds;
    },

    rewind: function() {
        
        if (this.activeTrack !== undefined) {
            this.activeTrack.notifySelectUpdate(0, 0);
        }
        else {
            this.config.setCursorPos(0);
        } 

        this.stop();

        this.trackContainer.scrollLeft = 0;
        this.config.setTrackScroll(0);
        this.fire('trackscroll');
    },

    fastForward: function() {
        var totalWidth = this.trackContainer.scrollWidth,
            clientWidth = this.trackContainer.offsetWidth,
            maxOffset = Math.max(totalWidth - clientWidth, 0);

        if (this.activeTrack !== undefined) {
            this.activeTrack.notifySelectUpdate(this.duration, this.duration);
        }
        else {
            this.config.setCursorPos(this.duration);
        }

        this.stop();

        this.trackContainer.scrollLeft = maxOffset;
        this.config.setTrackScroll(maxOffset);
        this.fire('trackscroll');
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

    play: function() {
        var editors = this.trackEditors,
            i,
            len,
            currentTime = this.config.getCurrentTime(),
            startTime = this.config.getCursorPos(),
            endTime,
            selected = this.getSelected();

        if (selected !== undefined && selected.endTime > startTime) {
            startTime = selected.startTime;
            endTime = selected.endTime;
        }

        if (this.pausedAt) {
            startTime = this.pausedAt;
        }

        for (i = 0, len = editors.length; i < len; i++) {
            editors[i].schedulePlay(currentTime, startTime, endTime);
        }

        this.lastPlay = currentTime;
        this.animationRequest = window.requestAnimationFrame(this.animationCallback);
    },

    pause: function() {
        var editors = this.trackEditors,
            i,
            len,
            currentTime = this.config.getCurrentTime(),
            startTime = this.config.getCursorPos();

        if (this.pausedAt) {
            startTime = this.pausedAt;
        }

        this.pausedAt = currentTime - this.lastPlay + startTime;

        window.cancelAnimationFrame(this.animationRequest);

        for (i = 0, len = editors.length; i < len; i++) {
            editors[i].scheduleStop(currentTime);
        }
    },

    stop: function() {
        var editors = this.trackEditors,
            i,
            len,
            currentTime = this.config.getCurrentTime();

        this.pausedAt = undefined;

        window.cancelAnimationFrame(this.animationRequest);

        for (i = 0, len = editors.length; i < len; i++) {
            editors[i].scheduleStop(currentTime);
            editors[i].showProgress(0);
        }
    },

    updateEditor: function() {
        var editors = this.trackEditors,
            i,
            len,
            currentTime = this.config.getCurrentTime(),
            elapsed = currentTime - this.lastPlay,
            cursorPos = this.config.getCursorPos(),
            playbackSec;

        //update drawer to start drawing from where last paused.
        if (this.pausedAt) {
            cursorPos = this.pausedAt;
        }

        if (this.isPlaying()) {
            //if there's a change for the UI show progress.
            if (elapsed) {
                playbackSec = cursorPos + elapsed;

                for (i = 0, len = editors.length; i < len; i++) {
                    editors[i].showProgress(playbackSec);
                }

                this.fire("playbackcursor", {
                    "seconds": playbackSec
                });
            }
            this.animationRequest = window.requestAnimationFrame(this.animationCallback);
        }
        else {
            //reset view to not playing look
            for (i = 0, len = editors.length; i < len; i++) {
                editors[i].showProgress(0);
            }

            this.pausedAt = undefined;
            window.cancelAnimationFrame(this.animationRequest);
        } 
    },

    getJson: function() {
        var editors = this.trackEditors,
            i,
            len,
            info = [],
            json;

        for (i = 0, len = editors.length; i < len; i++) {
            info.push(editors[i].getTrackDetails());
        }

        json = JSON.stringify(info);

        return info;
    },

    save: function() {
         var editors = this.trackEditors,
            i,
            len,
            info = [];

        for (i = 0, len = editors.length; i < len; i++) {
            info.push(editors[i].getTrackDetails());
        }

        this.storage.save("test", info);
    },

    restore: function() {
        var state;

        state = this.storage.restore("test");

        this.destroy();
        this.init(state);
    },

    destroy: function() {
        var editors = this.trackEditors,
            i,
            len,
            info = [];

        for (i = 0, len = editors.length; i < len; i++) {
            editors[i].reset();
        }

        this.audioControls.reset();
        this.timeScale && this.timeScale.reset();
        this.reset();

        this.trackContainer.innerHTML='';
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
'use strict';

WaveformPlaylist.states = WaveformPlaylist.states || {};

/*
  called with an instance of Track as 'this'
*/
WaveformPlaylist.states.fadein = {

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
'use strict';

WaveformPlaylist.states = WaveformPlaylist.states || {};

/*
  called with an instance of Track as 'this'
*/

WaveformPlaylist.states.select = {

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
'use strict';

WaveformPlaylist.states = WaveformPlaylist.states || {};

/*
  called with an instance of Track as 'this'
*/
WaveformPlaylist.states.shift = {

  classes: "state-shift",

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
      mousedown event in 'shift' mode
  */
  event: function(e) {
      e.preventDefault();

      var el = this.container, //want the events placed on the channel wrapper.
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
          editor.setLeftOffset(editor.pixelsToSamples(updatedX));

          //update track's start and end time relative to the playlist.
          editor.startTime = editor.startTime + delta;
          editor.endTime = editor.endTime + delta;
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

    events: {
       "btn-rewind": {
            click: "rewindAudio"
        },

        "btn-fast-forward": {
            click: "fastForwardAudio"
        },

       "btn-play": {
            click: "playAudio"
        },

        "btn-pause": {
            click: "pauseAudio"
        },
     
        "btn-stop": {
            click: "stopAudio"
        },

        "btn-cursor": {
            click: "changeState"
        },

        "btn-select": {
            click: "changeState"
        },

        "btn-shift": {
            click: "changeState"
        },

        "btn-fadein": {
            click: "changeState"
        },

        "btn-fadeout": {
            click: "changeState"
        },

        "btn-save": {
            click: "save"
        },

        "btn-open": {
            click: "open"
        },
        
        "btn-trim-audio": {
            click: "trimAudio"
        },

        "time-format": {
            change: "changeTimeFormat"
        },

        "audio-pos": {

        },

        "audio-start": {
            blur: "validateCueIn"
        },

        "audio-end": {
            blur: "validateCueOut"
        },

        "btn-logarithmic": {
            click: "changeDefaultFade"
        },

        "btn-linear": {
            click: "changeDefaultFade"
        },

        "btn-exponential": {
            click: "changeDefaultFade"
        },

        "btn-sCurve": {
            click: "changeDefaultFade"
        },

        "btn-zoom-in": {
            click: "zoomIn"
        },

        "btn-zoom-out": {
            click: "zoomOut"
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

    init: function() {
        var that = this,
            className,
            event,
            events = this.events,
            tmpEl,
            func,
            state,
            container,
            fadeType,
            tmpBtn;

        WaveformPlaylist.makePublisher(this);

        this.ctrls = {};
        container = this.config.getContainer();
        state = this.config.getState();
        fadeType = this.config.getFadeType();

        ["btn-"+state, "btn-"+fadeType].forEach(function(buttonClass) {
            tmpBtn = document.getElementsByClassName(buttonClass)[0];

            if (tmpBtn) {
                this.activateButton(tmpBtn);
            }
        }, this);  

        for (className in events) {
        
            tmpEl = container.getElementsByClassName(className)[0];
            this.ctrls[className] = tmpEl;

            for (event in events[className]) {

                if (tmpEl) {
                    func = that[events[className][event]].bind(that);
                    tmpEl.addEventListener(event, func);
                }
            }
        } 

        if (this.ctrls["time-format"]) {
            this.ctrls["time-format"].value = this.config.getTimeFormat();
        }


        this.timeFormat = this.config.getTimeFormat();

        //Kept in seconds so time format change can update fields easily.
        this.currentSelectionValues = undefined;

        this.onCursorSelection({
            start: 0,
            end: 0
        });
    },

    changeDefaultFade: function(e) {
        var el = e.currentTarget,
            prevEl = el.parentElement.getElementsByClassName('active')[0],
            type = el.dataset.fade;

        this.deactivateButton(prevEl);
        this.activateButton(el);

        this.config.setFadeType(type);
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
        this.fire('playlistsave', this);
    },

    open: function() {
        this.fire('playlistrestore', this);
    },

    rewindAudio: function() {
        this.fire('rewindaudio', this);
    },

    fastForwardAudio: function() {
        this.fire('fastforwardaudio', this);
    },

    playAudio: function() {
        this.fire('playaudio', this);
    },

    pauseAudio: function() {
        this.fire('pauseaudio', this);
    },

    stopAudio: function() {
        this.fire('stopaudio', this);
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
        var el = e.currentTarget,
            prevEl = el.parentElement.getElementsByClassName('active')[0],
            state = el.dataset.state;

        this.deactivateButton(prevEl);
        this.activateButton(el);

        this.config.setState(state);
        this.fire('changestate', this);
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

        this.fadeGain = undefined;
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

        this.fadeGain = this.ac.createGain();

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

    onSourceEnded: function(e) {
        this.source.disconnect();
        this.source = undefined;

        this.fadeGain.disconnect();
        this.fadeGain = undefined;
    },

    setUpSource: function() {
        this.source = this.ac.createBufferSource();
        this.source.buffer = this.buffer;

        //keep track of the buffer state.
        this.source.onended = this.onSourceEnded.bind(this);

        this.source.connect(this.fadeGain);
        this.fadeGain.connect(this.destination);
    },

    /*
        source.start is picky when passing the end time. 
        If rounding error causes a number to make the source think 
        it is playing slightly more samples than it has it won't play at all.
        Unfortunately it doesn't seem to work if you just give it a start time.
    */
    play: function(when, start, duration) {
        this.setUpSource();
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
            resizeTimer;

        WaveformPlaylist.makePublisher(this);

        div = document.querySelector(".playlist-time-scale");
        div.style.position = "relative";
        div.style.left = 0;
        div.style.right = 0;

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

    /*
        Return time in format mm:ss
    */
    formatTime: function(seconds) {
        var out, m, s;

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
            canv = this.canv,
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
            container = this.container,
            width = this.width,
            height = this.height,
            div,
            time,
            sTime,
            fragment = document.createDocumentFragment(),
            scaleY,
            scaleHeight;


        this.clear();

        fragment.appendChild(canv);
        cc.fillStyle = colors.timeColor;
        end = width + pixOffset;

        for (i = 0; i < end; i = i + pixPerSec) {

            pixIndex = ~~(i);
            pix = pixIndex - pixOffset;

            if (pixIndex >= pixOffset) {

                //put a timestamp every 30 seconds.
                if (counter % 30 === 0) {

                    sTime = this.formatTime(counter);
                    time = document.createTextNode(sTime);
                    div = document.createElement("div");
            
                    div.style.position = "absolute";
                    div.style.left = pix+"px";
                    div.appendChild(time);
                    fragment.appendChild(div);

                    scaleHeight = 10;
                    scaleY = height - scaleHeight;
                }
                else if (counter % 5 === 0) {
                    scaleHeight = 5;
                    scaleY = height - scaleHeight;
                }
                else {
                    scaleHeight = 2;
                    scaleY = height - scaleHeight;
                }

                cc.fillRect(pix, scaleY, 1, scaleHeight);
            }

            counter++;  
        }

        container.appendChild(fragment);
    },

    onTrackScroll: function() {
        var scroll = this.config.getTrackScroll(),
            scrollX = scroll.left;    

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
            'shift': true
        };

        //extend enabled states config.
        Object.keys(statesEnabled).forEach(function (key) {
            statesEnabled[key] = (key in stateConfig) ? stateConfig[key] : statesEnabled[key];
        });

        this.enabledStates = statesEnabled;
       
        WaveformPlaylist.makePublisher(this);

        this.container = document.createElement("div");
        this.container.classList.add("channel-wrapper");
        this.container.style.position = "relative";

        this.drawer = Object.create(WaveformPlaylist.WaveformDrawer, {
            config: {
                value: this.config
            },
            container: {
                value: this.container
            }
        });
        this.drawer.init();

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

        this.setState(this.config.getState());

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
        //selected area stored in seconds relative to entire playlist.
        this.selectedArea = undefined;
        this.drawer.drawLoading();

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
            track.states || {}
        );

        if (track.selected !== undefined) {
            this.selectedArea = {
                startTime: track.selected.start,
                endTime: track.selected.end
            };
        }

        this.loadBuffer(track.src);

        return el;
    },

    /**
     * Loads an audio file via XHR.
     */
    loadBuffer: function(src) {
        var that = this,
            xhr = new XMLHttpRequest();

        xhr.open('GET', src, true);
        xhr.responseType = 'arraybuffer';

        xhr.addEventListener('progress', function(e) {
            var percentComplete;

            if (e.lengthComputable) {
                percentComplete = e.loaded / e.total * 100;
                that.drawer.updateLoader(percentComplete);
            } 

        }, false);

        xhr.addEventListener('load', function(e) {
            that.src = src;
            that.drawer.setLoaderState("decoding");

            that.playout.loadData(
                e.target.response,
                that.onTrackLoad.bind(that)
            );
        }, false);

        xhr.send();
    },

    drawTrack: function(buffer) {

        this.drawer.drawBuffer(buffer, this.cues);
        this.drawer.drawFades(this.fades);
    },

    onTrackLoad: function(buffer, err) {
        var res,
            startTime,
            endTime,
            cuein,
            cueout;

        if (err !== undefined) {
            this.container.innerHTML = "";
            this.container.classList.add("error");
            this.fire('unregister');
            return;
        }

        cuein = (this.cuein && this.secondsToSamples(this.cuein)) || 0;
        cueout = (this.cueout && this.secondsToSamples(this.cueout)) || buffer.length;

        this.setCuePoints(cuein, cueout);

        this.drawTrack(buffer);
        this.setLeftOffset(this.secondsToSamples(this.startTime));

        if (this.selectedArea !== undefined) {
            startTime = this.selectedArea.startTime;
            endTime = this.selectedArea.endTime;

            this.notifySelectUpdate(startTime, endTime);
        }
    },

    activate: function() {
        this.active = true;
        this.container.classList.add("active");
    },

    deactivate: function() {
        this.active = false;
        this.container.classList.remove("active");
        
        if (this.selectedArea) {
            this.selectedArea = undefined;
            this.drawer.selection && this.drawer.container.removeChild(this.drawer.selection);
            this.drawer.selection = undefined;
        }
    },

    /*
        startTime, endTime in seconds.
    */
    notifySelectUpdate: function(startTime, endTime, shiftKey) {
        this.setSelectedArea(startTime, endTime, shiftKey);

        if (startTime < endTime) {
            this.activateAudioSelection();
        }
        else {
            this.deactivateAudioSelection();
        }

        this.fire('changecursor', {
            start: startTime,
            end: endTime,
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

    /*
        startTime, endTime in seconds (float).
        segment is for a highlighted section in the UI.
    */
    schedulePlay: function(now, startTime, endTime) { 
        var start,
            duration,
            relPos,
            when = now,
            segment = (endTime) ? (endTime - startTime) : undefined,
            cueOffset = this.cues.cuein / this.sampleRate;

        //track has no content to play.
        if (this.endTime <= startTime) return;

        //track does not play in this selection.
        if (segment && (startTime + segment) < this.startTime) return;


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
        this.playout.applyFades(this.fades, relPos, now);
        this.playout.play(when, start, duration);
    },

    scheduleStop: function(when) {
        this.playout.stop(when);
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
    }
};

WaveformPlaylist.mixin(WaveformPlaylist.TrackEditor, WaveformPlaylist.unitConversions);

'use strict';

WaveformPlaylist.WaveformDrawer = {

    init: function() {

        WaveformPlaylist.makePublisher(this);

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
        Returns a layerOffset in pixels relative to the entire playlist.
    */
    findLayerOffset: function(target) {
        var layerOffset = 0,
            parent;

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

        }
        else {
            //selection div may even throw us off.
            if (target.classList.contains('selection')) {
                layerOffset += target.offsetLeft;
            }
        }

        return layerOffset;
    },

    drawBuffer: function(buffer, cues) {
        var canv,
            div,
            progress,
            cursor,
            surface,
            i,
            top = 0,
            left = 0,
            makeMono = this.config.isDisplayMono(),
            res = this.config.getResolution(),
            numChan = makeMono? 1 : buffer.numberOfChannels,
            numSamples = cues.cueout - cues.cuein + 1,
            fragment = document.createDocumentFragment(),
            wrapperHeight; 

        this.container.innerHTML = "";
        this.channels = []; 
        this.selection = undefined; 

        //width and height is per waveform canvas.
        this.width = Math.ceil(numSamples / res);
        this.height = this.config.getWaveHeight();

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

            //canvas with the waveform drawn
            canv = document.createElement("canvas");
            canv.setAttribute('width', this.width);
            canv.setAttribute('height', this.height);
            canv.style.position = "absolute";
            canv.style.margin = 0;
            canv.style.padding = 0;
            canv.style.zIndex = 3;

            //will be used later for evelopes now.
            surface = document.createElement("canvas");
            surface.setAttribute('width', this.width);
            surface.setAttribute('height', this.height);
            surface.style.position = "absolute";
            surface.style.margin = 0;
            surface.style.padding = 0;
            surface.style.zIndex = 4;

            this.channels.push({
                context: canv.getContext('2d'),
                div: div,
                progress: progress,
                surface: surface.getContext('2d')
            });

            div.appendChild(canv);
            div.appendChild(progress);
            div.appendChild(surface);
            fragment.appendChild(div);

            top = top + this.height;
        }

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
      
        wrapperHeight = numChan * this.height;
        this.container.style.height = wrapperHeight+"px";
        this.container.appendChild(fragment);
        
        this.getPeaks(buffer, cues);
        this.draw();
        this.drawTimeShift();
    },

    drawFrame: function(chanNum, index, peak) {
        var x, y, w, h, max, min,
            h2 = this.height / 2,
            cc = this.channels[chanNum].context,
            colors = this.config.getColorScheme();

        max = Math.abs(peak.max * h2);
        min = Math.abs(peak.min * h2);

        w = 1;
        x = index * w;
        
        cc.fillStyle = colors.waveOutlineColor;

        //draw maxs
        cc.fillRect(x, 0, w, h2-max);
        //draw mins
        cc.fillRect(x, h2+min, w, h2-min);
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
        Clear the surface canvas where envelopes etc will be drawn.
    */
    clear: function() {
        var i, len;

        for (i = 0, len = this.channels.length; i < len; i++) {
            this.channels[i].surface.clearRect(0, 0, this.width, this.height);
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
        selection.style.zIndex = 2000;

        if (this.selection === undefined) {
            this.container.appendChild(selection);
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
