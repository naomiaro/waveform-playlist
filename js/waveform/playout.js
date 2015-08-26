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
