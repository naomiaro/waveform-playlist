'use strict';

import _ from 'lodash';

import h from 'virtual-dom/h';
import diff from 'virtual-dom/diff';
import patch from 'virtual-dom/patch';
import createElement from 'virtual-dom/create-element';

import {secondsToPixels} from './utils/conversions'
import extractPeaks from './utils/peaks';
import LoaderFactory from './track/loader/LoaderFactory';

import ScrollHook from './render/ScrollHook';

import Track from './Track';
import Playout from './Playout';

export default class {

    constructor() {

        this.tracks = [];
        this.soloedTracks = [];
        this.mutedTracks = [];
        this.playoutPromises = [];

        this.cursor = 0;
        this.playbackSeconds = 0;
        this.length = 0;
        this.scrollLeft = 0;
    }

    setConfig(config) {
        this.config = config;
    }

    setContainer(container) {
        this.container = container;
    }

    setEventEmitter(ee) {
        this.ee = ee;
    }

    getEventEmitter() {
        return this.ee;
    }

    setUpEventEmitter() {
        let ee = this.ee;

        ee.on('select', (start, end, track) => {

            if (this.isPlaying()) {
                this.lastSeeked = start;
                this.pausedAt = undefined;
                this.restartPlayFrom(start);
            }
            else {
                //reset if it was paused.
                this.playbackSeconds = 0;
                this.setTimeSelection(start, end);
                this.setActiveTrack(track);
                this.draw(this.render());
            }
        });

        ee.on('play', () => {
            this.play();
        });

        ee.on('pause', () => {
            this.pause();
        });

        ee.on('stop', () => {
            this.stop();
        });

        ee.on('rewind', () => {
            this.rewind();
        });

        ee.on('fastforward', () => {
            this.fastForward();
        });
    }

    load(trackList, options={}) {
        let loadPromises = trackList.map((trackInfo) => {
            let loader = LoaderFactory.createLoader(trackInfo.src, this.config.getAudioContext());
            return loader.load();
        });

        return Promise.all(loadPromises).then((audioBuffers) => {
            let trackEditors = audioBuffers.map((audioBuffer, index) => {
                let name = trackList[index].name;

                //extract peaks with AudioContext for now.
                let peaks = extractPeaks(audioBuffer, this.config.getResolution(), this.config.isMono());
                //webaudio specific playout for now.
                let playout = new Playout(this.config.getAudioContext(), audioBuffer);
                let trackEditor = new Track(this.ee, playout, name);

                trackEditor.setPeaks(peaks);

                this.length = Math.max(this.length, trackEditor.endTime);

                return trackEditor;
            });

            this.tracks = trackEditors;

            return trackEditors;

        }).then((trackEditors) => {

            this.setState(this.config.getState());

            //take care of virtual dom rendering.
            let tree = this.render();
            let rootNode = createElement(tree);

            this.container.appendChild(rootNode);
            this.tree = tree;
            this.rootNode = rootNode;

            return trackEditors;
        });
    }

    /*
        track instance of Track.
    */
    setActiveTrack(track) {
        this.activeTrack = track;
    }

    getActiveTrack() {
        return this.activeTrack;
    }

    /*
        start, end in seconds.
    */
    setTimeSelection(start, end) {
        this.timeSelection = {
            start,
            end,
        };

        this.cursor = start;
    }

    getTimeSelection() {
        return this.timeSelection;
    }

    setState(state) {
        this.tracks.forEach((editor) => {
            editor.setState(state);
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

    isPlaying() {
        return this.tracks.reduce((isPlaying, track) => {
            return isPlaying || track.isPlaying();
        }, false);
    }

    /*
    *   returns the current point of time in the playlist in seconds.
    */
    getCurrentTime() {
        let cursorPos = this.lastSeeked || this.pausedAt || this.cursor;

        return cursorPos + this.getElapsedTime();
    }

    getElapsedTime() {
        let currentTime = this.config.getCurrentTime();

        return currentTime - this.lastPlay;
    }

    restartPlayFrom(cursorPos) {
        this.stopAnimation();

        this.tracks.forEach((editor) => {
            editor.scheduleStop();
        });

        Promise.all(this.playoutPromises).then(this.play.bind(this, cursorPos));
    }

    play(startTime) {
        var currentTime = this.config.getCurrentTime(),
            endTime,
            selected = this.getTimeSelection(),
            playoutPromises = [];

        startTime = startTime || this.pausedAt || this.cursor;

        if (selected.endTime > startTime) {
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
        this.playbackReset();
    }

    stop() {
        this.pausedAt = undefined;
        this.playbackSeconds = 0;
        this.playbackReset();
    }

    playbackReset() {
        this.lastSeeked = undefined;
        this.stopAnimation();

        this.tracks.forEach((editor) => {
            editor.scheduleStop();
        });

        this.setState(this.config.getState());
        this.draw(this.render());
    }

    rewind() {
        this.stop();

        Promise.all(this.playoutPromises).then(() => {
            this.scrollLeft = 0;
            this.ee.emit('select', 0, 0);
        });
    }

    fastForward() {
        this.stop();

        Promise.all(this.playoutPromises).then(() => {
            this.scrollLeft = this.length;
            this.ee.emit('select', this.length, this.length);
        });
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
    * Animation function for the playlist.
    */
    updateEditor(cursorPos) {
        let currentTime = this.config.getCurrentTime();
        let playbackSeconds = 0;
        let elapsed;

        cursorPos = cursorPos || this.cursor;
        elapsed = currentTime - this.lastDraw;

        if (this.isPlaying()) {
            playbackSeconds = cursorPos + elapsed;

            this.animationRequest = window.requestAnimationFrame(this.updateEditor.bind(this, playbackSeconds));
        }
        else {
            this.stopAnimation();
            this.pausedAt = undefined;
            this.lastSeeked = undefined;

            //TODO reset state and draw here?
        }

        this.playbackSeconds = playbackSeconds;

        this.draw(this.render());
        this.lastDraw = currentTime;
    }

    draw(newTree) {
        let patches = diff(this.tree, newTree);
        this.rootNode = patch(this.rootNode, patches);
        this.tree = newTree;
    }

    getTrackRenderData(data={}) {
        let defaults = {
            "height": this.config.getWaveHeight(),
            "resolution": this.config.getResolution(),
            "sampleRate": this.config.getSampleRate(),
            "controls": this.config.getControlSettings(),
            "isActive": false,
            "timeSelection": this.getTimeSelection(),
            "playlistLength": this.length,
            "playbackSeconds": this.playbackSeconds,
            "colors": this.config.getColorScheme()
        };

        return _.defaults(data, defaults);
    }

    render() {
        var activeTrack = this.getActiveTrack();

        let trackElements = this.tracks.map((track) => {
            return track.render(this.getTrackRenderData({
                "isActive": (activeTrack === track) ? true : false
            }));
        });

        let resolution = this.config.getResolution();
        let sampleRate = this.config.getSampleRate();
        let scrollX = secondsToPixels(this.scrollLeft, resolution, sampleRate);

        return h("div.playlist", {
            "attributes": {
                "style": "overflow: hidden; position: relative;"
            }}, [
            h("div.playlist-tracks", {
                "attributes": {
                    "style": "overflow: auto;",
                    "data-scroll-left": scrollX
                },
                "scrollLeft": scrollX,
                "hook": new ScrollHook(this)
            }, trackElements)
        ]);
    }  
}