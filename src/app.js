import _assign from 'lodash/object/assign';
import createElement from 'virtual-dom/create-element';

import Delegator from 'dom-delegator';
import EventEmitter from 'event-emitter';

import Playlist from './Playlist';

export function init(options={}, ee=EventEmitter(), delegator=Delegator()) {
    if (options.container === undefined) {
        throw new Error("DOM element container must be given.");
    }

    let defaults = {
        ac: new (window.AudioContext || window.webkitAudioContext),
        sampleRate: 44100,
        samplesPerPixel: 4096, //resolution - frames per pixel to draw.
        timeFormat: 'hh:mm:ss.uu',
        mono: true, //whether to draw multiple channels or combine them.
        fadeType: 'logarithmic',
        timescale: false, //whether or not to include the time measure.
        controls: {
            show: false, //whether or not to include the track controls
            width: 150, //width of controls in pixels
        },
        colors: {
            waveOutlineColor: 'white',
            timeColor: 'grey',
            fadeColor: 'black'
        },
        waveHeight: 128, //height of each canvas element a waveform is on.
        state: 'cursor',
        peaks: {
            type: "WebAudio",
            mono: true
        }
    };

    let config = _assign(defaults, options);

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

    //take care of initial virtual dom rendering.
    let tree = playlist.render();
    let rootNode = createElement(tree);

    config.container.appendChild(rootNode);
    playlist.tree = tree;
    playlist.rootNode = rootNode;

    //have to add extra events that aren't followed by default.
    delegator.listenTo("scroll");

    return playlist;
}