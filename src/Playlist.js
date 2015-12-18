'use strict';

import h from 'virtual-dom/h';
import diff from 'virtual-dom/diff';
import patch from 'virtual-dom/patch';
import createElement from 'virtual-dom/create-element';

import Delegator from 'dom-delegator';

import extractPeaks from './utils/peaks';
import LoaderFactory from './track/loader/LoaderFactory';
import Track from './Track';
import Playout from './Playout';
import Config from './Config'

var del = Delegator();

export default class {

    constructor(options={}) {
        //selected area stored in seconds relative to entire playlist.

        if (options.container === undefined) {
            throw new Error("DOM element container must be given.");
        }

        this.container = options.container;
        delete options.container;

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
            let trackEditors = audioBuffers.map((audioBuffer, index) => {
                let name = trackList[index].name;

                //extract peaks with AudioContext for now.
                let peaks = extractPeaks(audioBuffer, this.config.getResolution(), this.config.isMono());
                //webaudio specific playout for now.
                let playout = new Playout(this.config.getAudioContext(), audioBuffer);
                let trackEditor = new Track(this.config, playout, name);

                trackEditor.setPeaks(peaks);

                return trackEditor;
            });

            this.tracks = trackEditors;

            return trackEditors;

        }).then((TrackEditors) => {

            let tree = this.render();
            let rootNode = createElement(tree);
            //draw to canvas here?
            this.container.appendChild(rootNode);
            this.tree = tree;
            this.rootNode = rootNode;

            return TrackEditors;
        });
    }

    getSelected() {
        return this.selectedArea;
    }

    setState(state) {
        this.tracks.forEach(function(editor) {
            editor.setState(state);
        }, this);
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

    isPlaying() {
        return this.tracks.reduce((isPlaying, track) => {
            return isPlaying || track.isPlaying();
        }, false);
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

        this.tracks.forEach((editor) => {
            playoutPromises.push(editor.schedulePlay(currentTime, startTime, endTime, {
                masterGain: this.shouldTrackPlay(editor) ? 1 : 0
            }));
        });

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
        this.animationRequest = window.requestAnimationFrame(this.updateEditor.bind(this, startTime));
    }

    stopAnimation() {
        window.cancelAnimationFrame(this.animationRequest);
        this.lastDraw = undefined;
    }

    /*
      Animation function for the playlist.
    */
    updateEditor(cursorPos) {
        let currentTime = this.config.getCurrentTime();
        let playbackSec = cursorPos;
        let elapsed;

        cursorPos = cursorPos || this.config.getCursorPos();
        elapsed = currentTime - this.lastDraw;

        if (this.isPlaying()) {
            //if there's a change for the UI show progress.
            if (elapsed) {
                playbackSec = cursorPos + elapsed;

                this.tracks.forEach((editor) => {
                    editor.setPlaybackSeconds(playbackSec);
                }, this);

            }

            this.animationRequest = window.requestAnimationFrame(this.updateEditor.bind(this, playbackSec));
        }
        else {
            //reset view to not playing look
            this.stopAnimation();

            this.tracks.forEach((editor) => {
                editor.setPlaybackSeconds(0);
            }, this);

            this.pausedAt = undefined;
            this.lastSeeked = undefined;
        }

        let newTree = this.render();
        let patches = diff(this.tree, newTree);
        this.rootNode = patch(this.rootNode, patches);
        this.tree = newTree;

        this.lastDraw = currentTime;
    }

    render() {
        let trackElements = this.tracks.map(function (track) {
            return track.render();
        });

        return h("div.playlist", {attributes: {
            "style": "overflow: hidden; position: relative;"
        }}, [
            h("div.playlist-tracks", {attributes: {
                "style": "overflow: auto;"
            }}, trackElements)
        ]);
    }  
}