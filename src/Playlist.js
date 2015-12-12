'use strict';

import LoaderFactory from './track/loader/LoaderFactory';
import Track from './Track';
import Config from './Config'

export default class {

    constructor(options={}) {
        //selected area stored in seconds relative to entire playlist.
        this.selectedArea = undefined;
        this.config = new Config(options);

        this.tracks = [];
        this.soloedTracks = [];
        this.mutedTracks = [];
    }

    load(trackList, options={}) {

        var loadPromises = trackList.map((trackInfo) => {
            let loader = LoaderFactory.createLoader(trackInfo.src, this.config.getAudioContext());
            let promise = loader.load();

            return promise;
        });

        return Promise.all(loadPromises).then((audioBuffers) => {
            let TrackEditors = audioBuffers.map((audioBuffer) => {
                let TrackEditor = new Track(this.config, audioBuffer);

                return TrackEditor;
            });

            return TrackEditors;

        }).then((TrackEditors) => {
            console.log(TrackEditors);

            this.tracks = TrackEditors;

            return TrackEditors;
        });
    }

    shouldTrackPlay(track) {
        var shouldPlay;
        //if there are solo tracks, only they should play.
        if (this.soloedTracks.length > 0) {
            shouldPlay = false;
            if (this.soloedTracks.indexOf(track) > -1) {
                shouldPlay = true;
            }
        }
        //play all tracks except any muted tracks.
        else {
            shouldPlay = true;
            if (this.mutedTracks.indexOf(track) > -1) {
                shouldPlay = false;
            }
        }

        return shouldPlay;
    }

    play(startTime) {
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
    }

    pause() {
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
    }

    stop() {
        this.pausedAt = undefined;
        this.lastSeeked = undefined;

        this.stopAnimation();

        this.trackEditors.forEach(function(editor) {
            editor.scheduleStop();
            //editor.showProgress(0);
        }, this);

        this.setState(this.config.getState());
    }

    startAnimation(startTime) {
        this.lastDraw = this.config.getCurrentTime();
        this.animationRequest = window.requestAnimationFrame(this.updateEditor.bind(startTime));
    }

    stopAnimation() {
        window.cancelAnimationFrame(this.animationRequest);
        this.lastDraw = undefined;
    }

    /*
      Animation function for the playlist.
    */
    updateEditor(cursorPos) {
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
    }

    render() {
        h("div.playlist-tracks", {attributes: {"style": "overflow: auto;"}});
    }
    
}