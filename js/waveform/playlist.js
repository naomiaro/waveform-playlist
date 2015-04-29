'use strict';

var PlaylistEditor = function() {

};

PlaylistEditor.prototype.setConfig = function(config) {
    this.config = config;
};

PlaylistEditor.prototype.init = function(tracks) {
    var that = this,
        i,
        len,
        container = this.config.getContainer(),
        div = container.getElementsByClassName("playlist-tracks")[0],
        fragment = document.createDocumentFragment(),
        trackEditor,
        trackElem,
        timeScale,
        audioControls;

    makePublisher(this);

    this.storage = new Storage();

    container.style.overflow = "hidden";

    this.trackContainer = div;
    this.trackContainer.style.position = "relative";
    this.trackContainer.style.overflow = "auto";

    this.trackEditors = [];

    audioControls = new AudioControls();
    audioControls.init(this.config);

    if (this.config.isTimeScaleEnabled()) {
        timeScale = new TimeScale();
        timeScale.init(this.config);
        audioControls.on("changeresolution", "onResolutionChange", timeScale);
        this.on("trackscroll", "onTrackScroll", timeScale);
    }

    this.timeScale = timeScale;
    
    for (i = 0, len = tracks.length; i < len; i++) {

        trackEditor = new TrackEditor();
        trackEditor.setConfig(this.config);
        trackElem = trackEditor.loadTrack(tracks[i]);
    
        this.trackEditors.push(trackEditor);
        fragment.appendChild(trackElem);

        audioControls.on("trackedit", "onTrackEdit", trackEditor);
        audioControls.on("changeresolution", "onResolutionChange", trackEditor);

        trackEditor.on("activateSelection", "onAudioSelection", audioControls);
        trackEditor.on("deactivateSelection", "onAudioDeselection", audioControls);
        trackEditor.on("changecursor", "onCursorSelection", audioControls);
        trackEditor.on("changecursor", "onSelectUpdate", this);

        trackEditor.on("unregister", (function() {
            var editor = this;

            audioControls.remove("trackedit", "onTrackEdit", editor);
            audioControls.remove("changeresolution", "onResolutionChange", editor);

            that.removeTrack(editor);

        }).bind(trackEditor));
    }

    this.trackContainer.innerHTML = '';
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
};

PlaylistEditor.prototype.removeTrack = function(trackEditor) {
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
};

PlaylistEditor.prototype.resize = function() {
    this.timeScale.onResize();
};

PlaylistEditor.prototype.onTrimAudio = function() {
    this.activeTrack && this.activeTrack.trim(); 
};

/*
    Called when a user manually updates the cue points in the UI.
    args start/end are in seconds
*/
PlaylistEditor.prototype.onSelectionChange = function(args) {

    this.config.setCursorPos(args.start);
    this.activeTrack && this.activeTrack.setSelectedArea(args.start, args.end);
};

PlaylistEditor.prototype.onStateChange = function() {
     var that = this,
        editors = this.trackEditors,
        i,
        len,
        editor,
        state = this.config.getState();

    for(i = 0, len = editors.length; i < len; i++) {
        editors[i].deactivate();
        editors[i].setState(state);
    }
};

PlaylistEditor.prototype.onTrackScroll = function() {
    var that = this;

    if (that.scrollTimeout) return;

    //limit the scroll firing to every 25ms.
    that.scrollTimeout = setTimeout(function() {
        
        that.config.setTrackScroll(that.trackContainer.scrollLeft, that.trackContainer.scrollTop);
        that.fire('trackscroll');
        that.scrollTimeout = false;
    }, 25);   
};

PlaylistEditor.prototype.activateTrack = function(trackEditor) {
    var that = this,
        editors = this.trackEditors,
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
};

PlaylistEditor.prototype.onSelectUpdate = function(event) {
    
    this.activateTrack(event.editor);
};

PlaylistEditor.prototype.resetCursor = function() {
    this.config.setCursorPos(0);
};

PlaylistEditor.prototype.rewind = function() {
    
    if (this.activeTrack !== undefined) {
        this.activeTrack.resetCursor();
    }
    else {
        this.resetCursor();
    } 

    this.stop();

    this.trackContainer.scrollLeft = 0;
    this.config.setTrackScroll(0);
    this.fire('trackscroll');
};

PlaylistEditor.prototype.fastForward = function() {
    var totalWidth = this.trackContainer.scrollWidth,
        clientWidth = this.trackContainer.offsetWidth,
        maxOffset = Math.max(totalWidth - clientWidth, 0);

    if (this.activeTrack !== undefined) {
        this.activeTrack.resetCursor();
    }

    this.stop();

    this.trackContainer.scrollLeft = maxOffset;
    this.config.setTrackScroll(maxOffset);
    this.fire('trackscroll');
};

/*
    returns selected time in global (playlist relative) seconds.
*/
PlaylistEditor.prototype.getSelected = function() {
    if (this.activeTrack) {
        return this.activeTrack.selectedArea;
    }
};

PlaylistEditor.prototype.isPlaying = function() {
     var editors = this.trackEditors,
        i,
        len,
        isPlaying = false;

    for (i = 0, len = editors.length; i < len; i++) {
        isPlaying = isPlaying || editors[i].isPlaying();
    }

    return isPlaying;
};

PlaylistEditor.prototype.play = function() {
    var that = this,
        editors = this.trackEditors,
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
};

PlaylistEditor.prototype.pause = function() {
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
};

PlaylistEditor.prototype.stop = function() {
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
};

PlaylistEditor.prototype.updateEditor = function() {
    var editors = this.trackEditors,
        i,
        len,
        currentTime = this.config.getCurrentTime(),
        elapsed = currentTime - this.lastPlay,
        res = this.config.getResolution(),
        cursorPos = this.config.getCursorPos(),
        cursorPixel,
        playbackSec;

    //update drawer to start drawing from where last paused.
    if (this.pausedAt) {
        cursorPos = this.pausedAt;
    }

    if (this.isPlaying()) {

        //if there's a change for the UI show progress.
        if (elapsed) {
            playbackSec = cursorPos + elapsed;
            cursorPixel = Math.ceil(playbackSec * this.sampleRate / res);
            
            for (i = 0, len = editors.length; i < len; i++) {
                editors[i].showProgress(cursorPixel);
            }

            this.fire("playbackcursor", {
                "seconds": playbackSec,
                "pixels": cursorPixel
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
};

PlaylistEditor.prototype.getJson = function() {
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
};

PlaylistEditor.prototype.save = function() {
     var editors = this.trackEditors,
        i,
        len,
        info = [];

    for (i = 0, len = editors.length; i < len; i++) {
        info.push(editors[i].getTrackDetails());
    }

    this.storage.save("test", info);
};

PlaylistEditor.prototype.restore = function() {
    var state;

    state = this.storage.restore("test");

    this.trackContainer.innerHTML='';
    this.init(state);
};

