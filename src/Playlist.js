'use strict';

import _defaults from 'lodash.defaults';

import h from 'virtual-dom/h';
import diff from 'virtual-dom/diff';
import patch from 'virtual-dom/patch';

import {pixelsToSeconds} from './utils/conversions';

import LoaderFactory from './track/loader/LoaderFactory';

import ScrollHook from './render/ScrollHook';

import TimeScale from './TimeScale';
import Track from './Track';
import Playout from './Playout';

const InlineWorker = require("inline-worker");

import RecorderWorkerFunction from './utils/recorderWorker';
import ExportWavWorkerFunction from './utils/exportWavWorker';

export default class {
    constructor() {

        this.tracks = [];
        this.soloedTracks = [];
        this.mutedTracks = [];
        this.playoutPromises = [];

        this.cursor = 0;
        this.playbackSeconds = 0;
        this.duration = 0;
        this.scrollLeft = 0;
        this.showTimescale = false;

        this.fadeType = "logarithmic";
        this.masterGain = 1;
    }

    //TODO extract into a plugin
    initExporter() {
        this.exportWorker = new InlineWorker(ExportWavWorkerFunction);
    }

    //TODO extract into a plugin
    initRecorder(stream) {
        this.mediaRecorder = new MediaRecorder(stream);

        this.mediaRecorder.onstart = (e) => {
            let track = new Track();
            track.setName("Recording");
            track.setEnabledStates();
            track.setEventEmitter(this.ee);

            this.recordingTrack = track;
            this.tracks.push(track);

            this.chunks = [];
        };

        this.mediaRecorder.ondataavailable = (e) => {
            this.chunks.push(e.data);

            let recording = new Blob(this.chunks, {'type': 'audio/ogg; codecs=opus'});
            let loader = LoaderFactory.createLoader(recording, this.ac);
            loader.load().then((audioBuffer) => {
                //ask web worker for peaks.
                this.recorderWorker.postMessage({
                    samples: audioBuffer.getChannelData(0),
                    samplesPerPixel: this.samplesPerPixel
                });
                this.recordingTrack.setCues(0, audioBuffer.duration);
                this.recordingTrack.setBuffer(audioBuffer);
                this.recordingTrack.setPlayout(new Playout(this.ac, audioBuffer));
                this.adjustDuration();
            });
        };

        this.recorderWorker = new InlineWorker(RecorderWorkerFunction);
        //use a worker for calculating recording peaks.
        this.recorderWorker.onmessage = (e) => {
            this.recordingTrack.setPeaks(e.data);
            this.draw(this.render());
        };

        this.recorderWorker.onerror = (e) => {
            console.log(e);
        };
    }

    setShowTimeScale(show) {
        this.showTimescale = show;
    }

    setMono(mono) {
        this.mono = mono;
    }

    setExclSolo(exclSolo) {
        this.exclSolo = exclSolo;
    }

    setSeekStyle(style) {
        this.seekStyle = style
    }

    getSeekStyle() {
        return this.seekStyle;
    }

    setSampleRate(sampleRate) {
        this.sampleRate = sampleRate;
    }

    setSamplesPerPixel(samplesPerPixel) {
        this.samplesPerPixel = samplesPerPixel;
    }

    setAudioContext(ac) {
        this.ac = ac;
    }

    setControlOptions(controlOptions) {
        this.controls = controlOptions;
    }

    setWaveHeight(height) {
        this.waveHeight = height;
    }

    setColors(colors) {
        this.colors = colors;
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
                this.seek(start, end, track)
                this.ee.emit('timeupdate', start);
                this.draw(this.render());
            }
        });

        ee.on('startaudiorendering', (type) => {
           this.startOfflineRender(type);
        });

        ee.on('statechange', (state) => {
            this.setState(state);
            this.draw(this.render());
        });

        ee.on('shift', (deltaTime, track) => {
            track.setStartTime(track.getStartTime() + deltaTime);
            this.adjustDuration();
            this.draw(this.render());
        });

        ee.on('record', () => {
            this.record();
        });

        ee.on('play', (start, end) => {
            this.play(start, end);
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

        ee.on('clear', () => {
            this.clear().then(() => {
                this.draw(this.render());
            });
        });

        ee.on('solo', (track) => {
            this.soloTrack(track);
            this.adjustTrackPlayout();
            this.draw(this.render());
        });

        ee.on('mute', (track) => {
            this.muteTrack(track);
            this.adjustTrackPlayout();
            this.draw(this.render());
        });

        ee.on('volumechange', (volume, track) => {
            track.setGainLevel(volume/100);
        });

        ee.on('mastervolumechange', (volume) => {
            this.masterGain = volume/100
            this.tracks.forEach((track) => {
                track.setMasterGainLevel(this.masterGain);
            });
        });

        ee.on('fadein', (duration, track) => {
            track.setFadeIn(duration, this.fadeType);
            this.draw(this.render());
        });

        ee.on('fadeout', (duration, track) => {
            track.setFadeOut(duration, this.fadeType);
            this.draw(this.render());
        });

        ee.on('fadetype', (type) => {
            this.fadeType = type;
        });

        ee.on('newtrack', (file) => {
            this.load([{
                src: file,
                name: file.name
            }]);
        });

        ee.on('trim', () => {
            let track = this.getActiveTrack();
            let timeSelection = this.getTimeSelection();

            track.trim(timeSelection.start, timeSelection.end);
            track.calculatePeaks(this.samplesPerPixel, this.sampleRate);

            this.setTimeSelection(0, 0);
            this.draw(this.render());
        });

        ee.on('zoomin', () => {
            let zoomIndex = Math.max(0, this.zoomIndex-1);
            let zoom = this.zoomLevels[zoomIndex];

            if (zoom !== this.samplesPerPixel) {
                this.setZoom(zoom);
                this.draw(this.render());
            }
        });

        ee.on('zoomout', () => {
            let zoomIndex = Math.min(this.zoomLevels.length-1, this.zoomIndex+1);
            let zoom = this.zoomLevels[zoomIndex];

            if (zoom !== this.samplesPerPixel) {
                this.setZoom(zoom);
                this.draw(this.render());
            }
        });

        ee.on('scroll', () => {
            this.draw(this.render());
        });
    }

    load(trackList, options={}) {
        let loadPromises = trackList.map((trackInfo) => {
            let loader = LoaderFactory.createLoader(trackInfo.src, this.ac, this.ee);
            return loader.load();
        });

        return Promise.all(loadPromises).then((audioBuffers) => {
            this.ee.emit('audiosourcesloaded');

            let tracks = audioBuffers.map((audioBuffer, index) => {
                let info = trackList[index];
                let name = info.name || "Untitled";
                let start = info.start || 0;
                let states = info.states || {};
                let fadeIn = info.fadeIn;
                let fadeOut = info.fadeOut;
                let cueIn = info.cuein || 0;
                let cueOut = info.cueout || audioBuffer.duration;
                let gain = info.gain || 1;
                let exclSolo = info.exclSolo || false;
                let muted = info.muted || false;
                let soloed = info.soloed || false;
                let selection = info.selected;
                let peaks = info.peaks || {type: "WebAudio", mono: this.mono};
                let customClass = info.customClass || undefined;

                //webaudio specific playout for now.
                let playout = new Playout(this.ac, audioBuffer);

                let track = new Track();
                track.src = info.src;
                track.setBuffer(audioBuffer);
                track.setName(name);
                track.setEventEmitter(this.ee);
                track.setEnabledStates(states);
                track.setCues(cueIn, cueOut);
                track.setCustomClass(customClass);

                if (fadeIn !== undefined) {
                    track.setFadeIn(fadeIn.duration, fadeIn.shape);
                }

                if (fadeOut !== undefined) {
                    track.setFadeOut(fadeOut.duration, fadeOut.shape);
                }

                if (selection !== undefined) {
                    this.setActiveTrack(track);
                    this.setTimeSelection(selection.start, selection.end);
                }

                if (peaks !== undefined) {
                    track.setPeakData(peaks);
                }

                track.setState(this.getState());
                track.setStartTime(start);
                track.setPlayout(playout);

                track.setGainLevel(gain);

                if (muted) {
                    this.muteTrack(track);
                }

                if (soloed) {
                    this.soloTrack(track);
                }

                //extract peaks with AudioContext for now.
                track.calculatePeaks(this.samplesPerPixel, this.sampleRate);

                return track;
            });

            this.tracks = this.tracks.concat(tracks);
            this.adjustDuration();
            this.draw(this.render());

            this.ee.emit('audiosourcesrendered');
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

    isSegmentSelection() {
        return this.timeSelection.start !== this.timeSelection.end;
    }

    /*
        start, end in seconds.
    */
    setTimeSelection(start=0, end=undefined) {
        this.timeSelection = {
            start,
            end: (end === undefined) ? start : end
        };

        this.cursor = start;
    }

    startOfflineRender(type){
        if (this.isRendering) {
            return;
        }

        this.isRendering = true;
        this.offlineAudioContext = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 44100*this.duration, 44100);

        var currentTime = this.offlineAudioContext.currentTime,
            startTime = 0,
            endTime = 0;

        this.tracks.forEach((track) => {
            track.setOfflinePlayout(new Playout(this.offlineAudioContext, track.buffer));
            track.schedulePlay(currentTime, startTime, endTime, {
                shouldPlay: this.shouldTrackPlay(track),
                masterGain : 0.8,
                isOffline : true
            });
        });

        /*
            TODO cleanup of different audio playouts handling.
        */
        this.offlineAudioContext.startRendering().then((audioBuffer) => {
            if (type == 'buffer') {
                this.ee.emit('audiorenderingfinished', type, audioBuffer);
                this.isRendering = false;
                return;
            }

            if (type == 'wav') {
                this.exportWorker.postMessage({
                    command: 'init',
                    config: {
                        sampleRate: 44100
                    }
                });

                // callback for `exportWAV`
                this.exportWorker.onmessage = (e) => {
                    this.ee.emit('audiorenderingfinished', type, e.data);
                    this.isRendering = false;

                    // clear out the buffer for next renderings.
                    this.exportWorker.postMessage({
                        command: 'clear'
                    });
                };

                // send the channel data from our buffer to the worker
                this.exportWorker.postMessage({
                    command: 'record',
                    buffer: [
                        audioBuffer.getChannelData(0),
                        audioBuffer.getChannelData(1)
                    ]
                });

                // ask the worker for a WAV
                this.exportWorker.postMessage({
                    command: 'exportWAV',
                    type: 'audio/wav'
                });
            }

        }).catch((e) => {
            console.log(e);
        });
    }

    getTimeSelection() {
        return this.timeSelection;
    }

    setState(state) {
        this.state = state;

        this.tracks.forEach((track) => {
            track.setState(state);
        });
    }

    getState() {
        return this.state;
    }

    setZoomIndex(index) {
        this.zoomIndex = index;
    }

    setZoomLevels(levels) {
        this.zoomLevels = levels;
    }

    setZoom(zoom) {
        this.samplesPerPixel = zoom;
        this.zoomIndex = this.zoomLevels.indexOf(zoom);
        this.tracks.forEach((track) => {
            track.calculatePeaks(zoom, this.sampleRate);
        });
    }

    muteTrack(track) {
        let mutedList = this.mutedTracks;
        let index = mutedList.indexOf(track);

        if (index > -1) {
            mutedList.splice(index, 1);
        }
        else {
            mutedList.push(track);
        }
    }

    soloTrack(track) {
        let soloedList = this.soloedTracks;
        let index = soloedList.indexOf(track);

        if (index > -1) {
            soloedList.splice(index, 1);
        }
        else {
            if (this.exclSolo) {
                this.soloedTracks = [track];
            } else {
                soloedList.push(track);
            }
        }
    }

    adjustTrackPlayout() {
        this.tracks.forEach((track) => {
            track.setShouldPlay(this.shouldTrackPlay(track));
        });
    }

    adjustDuration() {
        this.duration = this.tracks.reduce((duration, track) => {
            return Math.max(duration, track.getEndTime());
        }, 0);
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
        return this.ac.currentTime - this.lastPlay;
    }

    setMasterGain(gain){
        this.ee.emit('mastervolumechange', gain);
    }

    restartPlayFrom(start, end) {
        this.stopAnimation();

        this.tracks.forEach((editor) => {
            editor.scheduleStop();
        });

        return Promise.all(this.playoutPromises).then(this.play.bind(this, start, end));
    }

    play(startTime, endTime) {
        var currentTime = this.ac.currentTime,
            selected = this.getTimeSelection(),
            playoutPromises = [];

        startTime = startTime || this.pausedAt || this.cursor;

        if (!endTime && selected.end !== selected.start && selected.end > startTime) {
            endTime = selected.end;
        }

        if (this.isPlaying()) {
            this.restartPlayFrom(startTime, endTime);
            return;
        }

        this.tracks.forEach((track) => {
            track.setState('cursor');
            playoutPromises.push(track.schedulePlay(currentTime, startTime, endTime, {
                shouldPlay: this.shouldTrackPlay(track),
                masterGain : this.masterGain
            }));
        });

        this.lastPlay = currentTime;
        //use these to track when the playlist has fully stopped.
        this.playoutPromises = playoutPromises;
        this.startAnimation(startTime);

        return Promise.all(this.playoutPromises);
    }

    pause() {
        if (!this.isPlaying()) {
            return;
        }

        this.pausedAt = this.getCurrentTime();
        return this.playbackReset();
    }

    stop() {
        this.mediaRecorder && this.mediaRecorder.state === "recording" && this.mediaRecorder.stop();
        this.pausedAt = undefined;
        this.playbackSeconds = 0;
        return this.playbackReset();
    }

    playbackReset() {
        this.lastSeeked = undefined;
        this.stopAnimation();

        this.tracks.forEach((track) => {
            track.scheduleStop();
            track.setState(this.getState());
        });

        this.draw(this.render());

        return Promise.all(this.playoutPromises);
    }

    rewind() {
        return this.stop().then(() => {
            this.scrollLeft = 0;
            this.ee.emit('select', 0, 0);
        });
    }

    fastForward() {
        return this.stop().then(() => {
            if (this.viewDuration < this.duration) {
                this.scrollLeft = this.duration - this.viewDuration;
            }
            else {
                this.scrollLeft = 0;
            }

            this.ee.emit('select', this.duration, this.duration);
        });
    }

    clear() {
       return this.stop().then(() => {
            this.tracks = [];
            this.soloedTracks = [];
            this.mutedTracks = [];
            this.playoutPromises = [];

            this.cursor = 0;
            this.playbackSeconds = 0;
            this.duration = 0;
            this.scrollLeft = 0;

            this.seek(0, 0, undefined);
        }); 
    }

    record() {
        let playoutPromises = [];
        this.mediaRecorder.start(300);

        this.tracks.forEach((track) => {
            track.setState('none');
            playoutPromises.push(track.schedulePlay(this.ac.currentTime, 0, undefined, {
                shouldPlay: this.shouldTrackPlay(track)
            }));
        });

        this.playoutPromises = playoutPromises;
    }

    startAnimation(startTime) {
        this.lastDraw = this.ac.currentTime;
        this.animationRequest = window.requestAnimationFrame(this.updateEditor.bind(this, startTime));
    }

    stopAnimation() {
        window.cancelAnimationFrame(this.animationRequest);
        this.lastDraw = undefined;
    }

    seek(start, end, track) {
        if (this.isPlaying()) {
            this.lastSeeked = start;
            this.pausedAt = undefined;
            this.restartPlayFrom(start);
        }
        else {
            //reset if it was paused.
            this.setActiveTrack(track || this.tracks[0]);
            this.pausedAt = start;
            this.setTimeSelection(start, end);
            if (this.getSeekStyle() == 'fill'){
                this.playbackSeconds = start;
            }
        }
    }

    /*
    * Animation function for the playlist.
    */
    updateEditor(cursorPos) {
        let currentTime = this.ac.currentTime;
        let playbackSeconds = 0;
        let elapsed;
        let selection = this.getTimeSelection();

        cursorPos = cursorPos || this.cursor;
        elapsed = currentTime - this.lastDraw;

        if (this.isPlaying()) {
            playbackSeconds = cursorPos + elapsed;
            this.ee.emit('timeupdate', playbackSeconds);
            this.animationRequest = window.requestAnimationFrame(
                this.updateEditor.bind(this, playbackSeconds)
            );
        }
        else {
            if ((cursorPos + elapsed) >=
              (this.isSegmentSelection()) ? selection.end : this.duration) {
                this.ee.emit('finished');
            }

            this.stopAnimation();
            this.pausedAt = undefined;
            this.lastSeeked = undefined;
            this.setState(this.getState());
        }

        this.playbackSeconds = playbackSeconds;

        this.draw(this.render());
        this.lastDraw = currentTime;
    }

    draw(newTree) {
        window.requestAnimationFrame(() => {
            let patches = diff(this.tree, newTree);
            this.rootNode = patch(this.rootNode, patches);
            this.tree = newTree;

            //use for fast forwarding.
            this.viewDuration = pixelsToSeconds(
              this.rootNode.clientWidth - this.controls.width,
              this.samplesPerPixel,
              this.sampleRate
            );
        });
    }

    getTrackRenderData(data={}) {
        let defaults = {
            "height": this.waveHeight,
            "resolution": this.samplesPerPixel,
            "sampleRate": this.sampleRate,
            "controls": this.controls,
            "isActive": false,
            "timeSelection": this.getTimeSelection(),
            "playlistLength": this.duration,
            "playbackSeconds": this.playbackSeconds,
            "colors": this.colors
        };

        return _defaults(data, defaults);
    }

    isActiveTrack(track) {
      let activeTrack = this.getActiveTrack();
      return this.isSegmentSelection() ?
        ((activeTrack === track) ? true : false) : true;
    }

    render() {
        let controlWidth = this.controls.show ? this.controls.width : 0;
        let timeScale = new TimeScale(this.duration, this.scrollLeft,
          this.samplesPerPixel, this.sampleRate, controlWidth);

        let trackElements = this.tracks.map((track) => {
            return track.render(this.getTrackRenderData({
                "isActive": this.isActiveTrack(track),
                "shouldPlay": this.shouldTrackPlay(track),
                "soloed": this.soloedTracks.indexOf(track) > -1,
                "muted": this.mutedTracks.indexOf(track) > -1
            }));
        });

        let trackSection = h("div.playlist-tracks", {
            "attributes": {
                "style": "overflow: auto;"
            },
            "onscroll": (e) => {
                this.scrollLeft = pixelsToSeconds(
                  e.target.scrollLeft,
                  this.samplesPerPixel,
                  this.sampleRate
                );
                this.ee.emit("scroll", this.scrollLeft);
            },
            "hook": new ScrollHook(this, this.samplesPerPixel, this.sampleRate)
        }, trackElements);

        let containerChildren = [];

        if (this.showTimescale) {
            containerChildren.push(timeScale.render());
        }

        containerChildren.push(trackSection);

        return h("div.playlist", {
            "attributes": {
                "style": "overflow: hidden; position: relative;"
            }},
            containerChildren
        );
    }

    getInfo() {
        var info = [];

        this.tracks.forEach((track) => {
            info.push(track.getTrackDetails());
        });

        return info;
    }
}
