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

    this.trackContainer = div;
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

    div.innerHTML = '';
    div.appendChild(fragment);
    div.onscroll = this.onTrackScroll.bind(that);

    this.sampleRate = this.config.getSampleRate();
   
    this.scrollTimeout = false;

    //for setInterval that's toggled during play/stop.
    this.interval;

    this.on("playbackcursor", "onAudioUpdate", audioControls);

    audioControls.on("playlistsave", "save", this);
    audioControls.on("playlistrestore", "restore", this);
    audioControls.on("rewindaudio", "rewind", this);
    audioControls.on("playaudio", "play", this);
    audioControls.on("stopaudio", "stop", this);
    audioControls.on("trimaudio", "onTrimAudio", this);
    audioControls.on("removeaudio", "onRemoveAudio", this);
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
    var track = this.activeTrack,
        selected = track.getSelectedArea(),
        start, end;

    if (selected === undefined) {
        return;
    }

    track.trim(selected.start, selected.end); 
};

PlaylistEditor.prototype.onRemoveAudio = function() {
    var track = this.activeTrack,
        selected = track.getSelectedArea(),
        start, end;

    if (selected === undefined) {
        return;
    }

    track.removeAudio(selected.start, selected.end);
};

PlaylistEditor.prototype.onSelectionChange = function(args) {
    
    if (this.activeTrack === undefined) {
        return;
    }

    var res = this.config.getResolution(),
        start = ~~(args.start * this.sampleRate / res),
        end = ~~(args.end * this.sampleRate / res);

    this.config.setCursorPos(args.start);
    this.activeTrack.setSelectedArea(start, end);
    this.activeTrack.updateEditor(-1, undefined, undefined, true);
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

PlaylistEditor.prototype.onTrackScroll = function(e) {
    var that = this,
        el = e.srcElement;

    if (that.scrollTimeout) return;

    //limit the scroll firing to every 25ms.
    that.scrollTimeout = setTimeout(function() {
        
        that.config.setTrackScroll(el.scrollLeft, el.scrollTop);
        that.fire('trackscroll', e);
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
    this.notifySelectUpdate(0, 0);
};

PlaylistEditor.prototype.onCursorSelection = function(args) {
    this.activateTrack(args.editor);
};

PlaylistEditor.prototype.rewind = function() {
    
    if (this.activeTrack !== undefined) {
        this.activeTrack.resetCursor();
    }
    else {
        this.resetCursor();
    } 

    this.stop();
};

/*
    returns selected time in global (playlist relative) seconds.
*/
PlaylistEditor.prototype.getSelected = function() {
    var selected,
        start,
        end;

    if (this.activeTrack) {
        selected = this.activeTrack.selectedArea;
        if (selected !== undefined && (selected.end > selected.start)) {
            return this.activeTrack.getSelectedPlayTime();
        }
    }
};

PlaylistEditor.prototype.isPlaying = function() {
     var that = this,
        editors = this.trackEditors,
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
        delay = 0.2,
        startTime = this.config.getCursorPos(),
        endTime,
        selected = this.getSelected();

    if (selected !== undefined) {
        startTime = selected.startTime;
        endTime = selected.endTime;
    }

    for (i = 0, len = editors.length; i < len; i++) {
        editors[i].schedulePlay(currentTime, delay, startTime, endTime);
    }

    this.lastPlay = currentTime + delay;
    this.interval = setInterval(that.updateEditor.bind(that), 25);
};

PlaylistEditor.prototype.stop = function() {
     var editors = this.trackEditors,
        i,
        len,
        currentTime = this.config.getCurrentTime();

    clearInterval(this.interval);

    for (i = 0, len = editors.length; i < len; i++) {
        editors[i].scheduleStop(currentTime);
        editors[i].updateEditor(-1, undefined, undefined, true);
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
        playbackSec,
        selected = this.getSelected(), 
        start, end,
        highlighted = false;

    if (selected !== undefined) {
        start = ~~(selected.startTime * this.sampleRate / res);
        end = Math.ceil(selected.endTime * this.sampleRate / res);
        highlighted = true;
    }

    if (this.isPlaying()) {

        if (elapsed) {
            playbackSec = cursorPos + elapsed;
            cursorPixel = Math.ceil(playbackSec * this.sampleRate / res);
            
            for (i = 0, len = editors.length; i < len; i++) {
                editors[i].updateEditor(cursorPixel, start, end, highlighted);
            }

            this.fire("playbackcursor", {
                "seconds": playbackSec,
                "pixels": cursorPixel
            });
        }
    }
    else {
        clearInterval(this.interval);

        for (i = 0, len = editors.length; i < len; i++) {
            editors[i].updateEditor(-1, undefined, undefined, true);
        }
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

