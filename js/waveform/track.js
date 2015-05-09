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
