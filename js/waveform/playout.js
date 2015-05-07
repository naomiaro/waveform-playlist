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
