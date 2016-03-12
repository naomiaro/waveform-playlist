import _assign from 'lodash.assign';
import createElement from 'virtual-dom/create-element';

import Delegator from 'dom-delegator';
import EventEmitter from 'event-emitter';

import Playlist from './Playlist';

export function init(options={}, ee=EventEmitter(), delegator=Delegator()) {
    if (options.container === undefined) {
        throw new Error("DOM element container must be given.");
    }

    let audioContext = new (window.AudioContext || window.webkitAudioContext);

    let defaults = {
        jsLocation: "js/", //needed for the webworker.
        ac: audioContext,
        sampleRate: audioContext.sampleRate,
        samplesPerPixel: 4096, //samples per pixel to draw, must be an entry in zoomLevels.
        mono: true, //whether to draw multiple channels or combine them.
        fadeType: 'logarithmic',
        timescale: false, //whether or not to include the time measure.
        controls: {
            show: false, //whether or not to include the track controls
            width: 150 //width of controls in pixels
        },
        colors: {
            waveOutlineColor: 'white',
            timeColor: 'grey',
            fadeColor: 'black'
        },
        waveHeight: 128, //height of each canvas element a waveform is on.
        state: 'cursor',
        zoomLevels: [512, 1024, 2048, 4096] //zoom levels in samples per pixel
    };

    let config = _assign(defaults, options);
    let zoomIndex = config.zoomLevels.indexOf(config.samplesPerPixel);

    if (zoomIndex === -1) {
        throw new Error("initial samplesPerPixel must be included in array zoomLevels");
    }

    let playlist = new Playlist();
    playlist.setSampleRate(config.sampleRate);
    playlist.setSamplesPerPixel(config.samplesPerPixel);
    playlist.setAudioContext(config.ac);
    playlist.setEventEmitter(ee);
    playlist.setUpEventEmitter();
    playlist.setTimeSelection(0, 0);
    playlist.setState(config.state);
    playlist.setControlOptions(config.controls);
    playlist.setWaveHeight(config.waveHeight);
    playlist.setColors(config.colors);
    playlist.setZoomLevels(config.zoomLevels);
    playlist.setZoomIndex(zoomIndex);
    playlist.setMono(config.mono);

    //take care of initial virtual dom rendering.
    let tree = playlist.render();
    let rootNode = createElement(tree);

    config.container.appendChild(rootNode);
    playlist.tree = tree;
    playlist.rootNode = rootNode;

    //have to add extra events that aren't followed by default.
    delegator.listenTo("scroll");

    __webpack_public_path__ = config.jsLocation;

    return playlist;
}