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

    for (id in fades) {

        fade = fades[id];

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

AudioPlayout.prototype.isUnScheduled = function() {
    return this.source && (this.source.playbackState === this.source.UNSCHEDULED_STATE);
};

AudioPlayout.prototype.isScheduled = function() {
    return this.source && (this.source.playbackState === this.source.SCHEDULED_STATE);
};

AudioPlayout.prototype.isPlaying = function() {
    return this.source && (this.source.playbackState === this.source.PLAYING_STATE);
};

AudioPlayout.prototype.isFinished = function() {
    return this.source && (this.source.playbackState === this.source.FINISHED_STATE);
};

AudioPlayout.prototype.getDuration = function() {
    return this.buffer.duration;
};

AudioPlayout.prototype.getPlayOffset = function() {
    var offset = 0;

    //TODO needs a fix for when the buffer naturally plays out. But also have to mind the entire playlist.
    if (this.playing) {
        offset = this.secondsOffset + (this.ac.currentTime - this.playTime);
    }
    else {
        offset = this.secondsOffset;
    }

    return offset;
};

AudioPlayout.prototype.setPlayedPercents = function(percent) {
    this.secondsOffset = this.getDuration() * percent;
};

AudioPlayout.prototype.getPlayedPercents = function() {
    return this.getPlayOffset() / this.getDuration();
};

AudioPlayout.prototype.setSource = function(source) {
    this.source && this.source.disconnect();
    this.source = source;
    this.source.buffer = this.buffer;

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

