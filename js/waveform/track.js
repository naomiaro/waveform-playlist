'use strict';

var TrackEditor = function() {

};

unitConversions.call(TrackEditor.prototype);

TrackEditor.prototype.states = {
    cursor: cursorState,
    select: selectState,
    fadein: fadeinState,
    fadeout: fadeoutState,
    shift: shiftState
};

TrackEditor.prototype.setConfig = function(config) {
    this.config = config;
};

//value leftOffset is measured in samples.
TrackEditor.prototype.setLeftOffset = function(offset) {
    this.leftOffset = offset;
    this.drawer.setPixelOffset(offset / this.resolution);
};

TrackEditor.prototype.init = function(src, start, end, fades, cues, stateConfig) {

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
   
    makePublisher(this);

    this.container = document.createElement("div");
    this.container.classList.add("channel-wrapper");
    this.container.style.position = "relative";

    this.drawer = new WaveformDrawer();
    this.drawer.init(this.container, this.config);

    this.playout = new AudioPlayout();
    this.playout.init(this.config);

    this.sampleRate = this.config.getSampleRate();
    this.resolution = this.config.getResolution();

    //value is a float in seconds
    this.startTime = start || 0;
    //value is a float in seconds
    this.endTime = end || 0; //set properly in onTrackLoad.

    this.setLeftOffset(this.secondsToSamples(this.startTime));

    this.setState(this.config.getState());

    this.fades = {};
    if (fades !== undefined && fades.length > 0) {
    
        for (var i = 0; i < fades.length; i++) {
            this.fades[this.getFadeId()] = fades[i];
        }
    }
    
    if (cues.cuein !== undefined) {
        this.setCuePoints(this.secondsToSamples(cues.cuein), this.secondsToSamples(cues.cueout));
    }
    
    this.active = false;
    this.selectedArea = undefined; //selected area of track stored as inclusive buffer indices to the audio buffer.
    this.drawer.drawLoading();

    return this.container;
};

TrackEditor.prototype.getFadeId = function() {
    var id = ""+Math.random();

    return id.replace(".", "");
};

TrackEditor.prototype.getBuffer = function() {
    return this.playout.getBuffer();
};

TrackEditor.prototype.loadTrack = function(track) {
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
            start: this.secondsToSamples(track.selected.start),
            end: this.secondsToSamples(track.selected.end)
        };
    }

    this.loadBuffer(track.src);

    return el;
};

/**
 * Loads an audio file via XHR.
 */
TrackEditor.prototype.loadBuffer = function(src) {
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
};

TrackEditor.prototype.drawTrack = function(buffer) {

    this.drawer.drawBuffer(buffer, this.cues);
    this.drawer.drawFades(this.fades);
};

TrackEditor.prototype.onTrackLoad = function(buffer, err) {
    var res,
        startTime,
        endTime;

    if (err !== undefined) {
        this.container.innerHTML = "";
        this.container.classList.add("error");

        this.fire('unregister');

        return;
    }

    if (this.cues === undefined) {
        this.setCuePoints(0, buffer.length - 1);
    }
    //adjust if the length was inaccurate and cueout is set to a higher sample than we actually have.
    else if (this.cues.cueout > (buffer.length - 1)) {
        this.cues.cueout = buffer.length - 1;
    }

    if (this.width !== undefined) {
        res = Math.ceil(buffer.length / this.width);

        this.config.setResolution(res);
        this.resolution = res;
    }
   
    this.drawTrack(buffer);

    if (this.selectedArea !== undefined) {
        startTime = this.samplesToSeconds(this.selectedArea.start);
        endTime = this.samplesToSeconds(this.selectedArea.end);

        this.config.setCursorPos(startTime);
        this.notifySelectUpdate(startTime, endTime);
    }
};

TrackEditor.prototype.activate = function() {
    this.active = true;
    this.container.classList.add("active");
};

TrackEditor.prototype.deactivate = function() {
    this.active = false;
    this.selectedArea = undefined;
    this.container.classList.remove("active");
    this.drawer.clear();
};

/*
    startTime, endTime in seconds.
*/
TrackEditor.prototype.notifySelectUpdate = function(startTime, endTime) {
    this.fire('changecursor', {
        start: startTime,
        end: endTime,
        editor: this
    });
};


TrackEditor.prototype.getSelectedPlayTime = function() {
    var selected = this.selectedArea,
        offset = this.leftOffset,
        start = this.samplesToSeconds(offset + selected.start),
        end = this.samplesToSeconds(offset + selected.end);

    return {
        startTime: start,
        endTime: end
    }
};


TrackEditor.prototype.getSelectedArea = function() {
    return this.selectedArea;
};

/*
    start, end in samples. (relative to cuein/cueout)
*/
TrackEditor.prototype.adjustSelectedArea = function(start, end) {
    var buffer = this.getBuffer(),
        cues = this.cues;

    if (start === undefined || start < 0) {
        start = 0;
    }

    if (end === undefined) {
        end = cues.cueout - cues.cuein;
    }

    if (end > buffer.length - 1) {
        end = buffer.length - 1;
    }

    return {
        start: start,
        end: end
    };
};

/*
    start, end in pixels
*/
TrackEditor.prototype.setSelectedArea = function(start, end, shiftKey) {
    var left, 
        right,
        currentStart,
        currentEnd,
        sampLeft,
        sampRight,
        buffer = this.getBuffer();

    //extending selected area since shift is pressed.
    if (shiftKey && (end - start === 0) && (this.prevSelectedArea !== undefined)) {

        currentStart = this.samplesToPixels(this.prevSelectedArea.start);
        currentEnd = this.samplesToPixels(this.prevSelectedArea.end);

        if (start < currentStart) {
            left = start;
            right = currentEnd;
        }
        else if (end > currentEnd) {
            left = currentStart;
            right = end;
        }
        //it's ambigous otherwise, cut off the smaller duration.
        else {
            if ((start - currentStart) < (currentEnd - start)) {
                left = start;
                right = currentEnd;
            }
            else {
                left = currentStart;
                right = end;
            }
        }
    }
    else {
        left = start;
        right = end;
    }

    sampLeft = left === undefined ? undefined : this.pixelsToSamples(left);
    sampRight = right === undefined ? undefined : this.pixelsToSamples(right);

    this.prevSelectedArea = this.selectedArea;
    this.selectedArea = this.adjustSelectedArea(sampLeft, sampRight);

    this.showSelection();
};

TrackEditor.prototype.activateAudioSelection = function() {

    this.fire("activateSelection");
};

TrackEditor.prototype.deactivateAudioSelection = function() {

    this.fire("deactivateSelection");
};

/*
    check to make sure a canvas was clicked not the channel wrapper
    returns -1 if it's not a canvas
*/
TrackEditor.prototype.findLayerOffset = function(e) {
    var layerOffset = 0,
        parent;

    if (e.target.tagName !== "CANVAS") {
        layerOffset = -1;
    }
    else {
        //have to check if a fade canvas was selected. (Must add left offset)
        parent = e.target.parentNode;

        if (parent.classList.contains('playlist-fade')) {
            layerOffset = parent.offsetLeft;
        }
    }

    return layerOffset;
};

TrackEditor.prototype.saveFade = function(id, type, shape, start, end) {
    
    this.fades[id] = {
        type: type,
        shape: shape,
        start: start,
        end: end
    };

    return id;
};

TrackEditor.prototype.removeFade = function(id) {

    delete this.fades[id];
    this.drawer.removeFade(id);
};

TrackEditor.prototype.removeFadeType = function(type) {
    var id,
        fades = this.fades,
        fade;

    for (id in fades) {
        fade = fades[id];

        if (fade.type === type) {
            this.removeFade(id);
        }
    }
};

/*
    Cue points are stored internally in the editor as sample indices for highest precision.

    sample at index cueout is not included.
*/
TrackEditor.prototype.setCuePoints = function(cuein, cueout) {
    var offset = this.cues ? this.cues.cuein : 0;

    this.cues = {
        cuein: offset + cuein,
        cueout: offset + cueout
    };

    this.duration = (cueout - cuein) / this.sampleRate;
    this.endTime = this.duration + this.startTime;
};

/*
    Will remove all audio samples from the track's buffer except for the currently selected area.
    Used to set cuein / cueout points in the audio.

    start, end are indices into the audio buffer and are inclusive.
*/
TrackEditor.prototype.trim = function(start, end) {
    
    this.setCuePoints(start, end+1);
    this.resetCursor();
    this.fades = {};
    this.drawTrack(this.getBuffer());
};

TrackEditor.prototype.onTrackEdit = function(event) {
    var type = event.type,
        method = "on" + type.charAt(0).toUpperCase() + type.slice(1);

    if (this.active === true) {
        this[method].call(this, event.args);
    }
};

TrackEditor.prototype.createFade = function(type, shape) {
    var selected = this.selectedArea,
        start = this.samplesToPixels(selected.start),
        end = this.samplesToPixels(selected.end),
        startTime = this.samplesToSeconds(selected.start),
        endTime = this.samplesToSeconds(selected.end),
        id = this.getFadeId();

    this.resetCursor();
    this.saveFade(id, type, shape, startTime, endTime);
    this.drawer.drawFade(id, type, shape, start, end);
};

TrackEditor.prototype.onCreateFade = function(args) {
    this.createFade(args.type, args.shape);
    this.deactivateAudioSelection();
};

TrackEditor.prototype.onTrimAudio = function() {
    var selected = this.getSelectedArea();

    this.trim(selected.start, selected.end);
    this.deactivateAudioSelection();
};

TrackEditor.prototype.setState = function(state) {
    //leave the past state if it was enabled
    this.currentState && this.currentState.leave.call(this);

    if (this.enabledStates[state]) {
        this.currentState = this.states[state];
        this.currentState.enter.call(this);
    }
};

TrackEditor.prototype.onResolutionChange = function(res) {
    var selected = this.selectedArea;

    this.resolution = res;
    this.drawTrack(this.getBuffer());
    this.drawer.setPixelOffset(this.leftOffset / res);

    if (this.active === true && this.selectedArea !== undefined) {
        
        this.drawer.drawHighlight(this.samplesToPixels(selected.start), this.samplesToPixels(selected.end));
    }
};

TrackEditor.prototype.isPlaying = function() {
    return this.playout.isPlaying();
};

/*
    startTime, endTime in seconds (float).
    segment is for a highlighted section in the UI.
*/
TrackEditor.prototype.schedulePlay = function(now, startTime, endTime) { 
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
};

TrackEditor.prototype.scheduleStop = function(when) {
   
    this.playout.stop(when);
};

TrackEditor.prototype.resetCursor = function() {
    this.selectedArea = undefined;
    this.config.setCursorPos(0);
    this.drawer.clear();
    this.notifySelectUpdate(0, 0);
};

TrackEditor.prototype.showProgress = function(cursorPos) {
    this.drawer.updateProgress(cursorPos);
};

TrackEditor.prototype.showSelection = function() {
    var start,
        end;

    start = this.samplesToPixels(this.selectedArea.start);
    end = this.samplesToPixels(this.selectedArea.end);

    this.drawer.drawHighlight(start, end);
};

TrackEditor.prototype.getTrackDetails = function() {
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
};
