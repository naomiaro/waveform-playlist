'use strict';

navigator.getUserMedia = (navigator.getUserMedia ||
                       navigator.webkitGetUserMedia ||
                       navigator.mozGetUserMedia ||
                       navigator.msGetUserMedia);

//keeping this global for now...
var userMediaStream;


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

        audioControls.on("recordtrack", "recordTrack", this);
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

        this.currentlyRecordingTrack = undefined;

        //set up for record functionality
        if (navigator.getUserMedia) {
           console.log('getUserMedia supported.');
           navigator.getUserMedia (
              {
                 audio: true
              },
              function(stream) {
                userMediaStream = stream;
                var recordButton = container.querySelector(".btn-record");
                if (recordButton) {
                  recordButton.classList.remove("disabled"); 
                }
              },
              function(err) {
                 console.log('The following gUM error occured: ' + err);
              }
           );
        }
        else {
           console.log('getUserMedia not supported on your browser!');
        }
    },

    recordTrack: function() {
        console.log("recording");

        var trackEditor = Object.create(WaveformPlaylist.TrackEditor, {
            config: {
                value: this.config
            }
        });
        var trackElem = trackEditor.init();

        trackEditor.setState('record');

        //keep track of the recording track.
        this.currentlyRecordingTrack = trackEditor;
    
        this.trackEditors.push(trackEditor);
        this.trackContainer.appendChild(trackElem);
        trackEditor.on("trackloaded", "onTrackLoad", this);
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
