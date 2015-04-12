'use strict';

var AudioPlayout = function() {

};

AudioPlayout.prototype.init = function(config) {

    makePublisher(this);

    this.config = config;
    this.ac = this.config.getAudioContext();

    this.fadeMaker = new Fades();
    this.fadeMaker.init(this.ac.sampleRate);
    
    this.gainNode = undefined;
    this.destination = this.ac.destination;
};

AudioPlayout.prototype.getBuffer = function() {
    return this.buffer;
};

AudioPlayout.prototype.setBuffer = function(buffer) {
    this.buffer = buffer;
};

/*
    param relPos: cursor position in seconds relative to this track.
        can be negative if the cursor is placed before the start of this track etc.
*/
AudioPlayout.prototype.applyFades = function(fades, relPos, now, delay) {
    var id,
        fade,
        fn,
        options,
        startTime,
        duration;

    this.gainNode && this.gainNode.disconnect();
    this.gainNode = this.ac.createGain();

    //loop through each fade on this track
    for (id in fades) {

        fade = fades[id];

        //skip fade if it's behind the cursor.
        if (relPos >= fade.end) {
            continue;
        }

        if (relPos <= fade.start) {
            startTime = now + (fade.start - relPos) + delay;
            duration = fade.end - fade.start;
        }
        else if (relPos > fade.start && relPos < fade.end) {
            startTime = now - (relPos - fade.start) + delay;
            duration = fade.end - fade.start;
        }

        options = {
            start: startTime,
            duration: duration
        };

        if (fades.hasOwnProperty(id)) {
            fn = this.fadeMaker["create"+fade.type];
            fn.call(this.fadeMaker, this.gainNode.gain, fade.shape, options);
        }
    }
};

/**
 * Loads audiobuffer.
 *
 * @param {AudioBuffer} audioData Audio data.
 */
AudioPlayout.prototype.loadData = function (audioData, cb) {
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
};

AudioPlayout.prototype.isPlaying = function() {
    return this.source !== undefined;
};

AudioPlayout.prototype.getDuration = function() {
    return this.buffer.duration;
};

AudioPlayout.prototype.onSourceEnded = function(e) {
    this.source.disconnect();
    this.source = undefined;
};

AudioPlayout.prototype.setSource = function(source) {
    this.source = source;
    this.source.buffer = this.buffer;

    //keep track of the buffer state.
    this.source.onended = this.onSourceEnded.bind(this);

    this.source.connect(this.gainNode);
    this.gainNode.connect(this.destination);
};

/*
    source.start is picky when passing the end time. 
    If rounding error causes a number to make the source think 
    it is playing slightly more samples than it has it won't play at all.
    Unfortunately it doesn't seem to work if you just give it a start time.
*/
AudioPlayout.prototype.play = function(when, start, duration) {
    if (!this.buffer) {
        console.error("no buffer to play");
        return;
    }

    this.setSource(this.ac.createBufferSource());
  
    this.source.start(when || 0, start, duration);
};

AudioPlayout.prototype.stop = function(when) {
 
    this.source && this.source.stop(when || 0);
};

