Waveform Playlist
=================

Inspired by [Audacity](http://audacity.sourceforge.net/), this project is a multiple track playlist editor written in ES2015 using the [Web Audio API](http://webaudio.github.io/web-audio-api/).

[See examples in action](http://naomiaro.github.io/waveform-playlist)

[![Build Status](https://travis-ci.org/naomiaro/waveform-playlist.svg)](https://travis-ci.org/naomiaro/waveform-playlist)

[![Coverage Status](https://coveralls.io/repos/naomiaro/waveform-playlist/badge.svg?branch=master&service=github)](https://coveralls.io/github/naomiaro/waveform-playlist?branch=master)

Load tracks and set cues (track cue in, cue out), fades (track fade in, fade out) and track start/end times within the playlist.
I've written up some demos on github for the different [audio fade types](https://github.com/naomiaro/Web-Audio-Fades) in the project.

![Screenshot](img/stemtracks.png?raw=true "stem tracks mute solo volume control")
(code for picture shown can be found in dist/examples/stem-tracks.html)

[Try out the waveform editor!](http://naomiaro.github.io/waveform-playlist/web-audio-editor.html)

## Installation

  `npm install waveform-playlist`

## Basic Usage

```javascript
var WaveformPlaylist = require('waveform-playlist');

var playlist = new WaveformPlaylist.init({
  jsLocation: "js/", //needed for the webworker (If you're recording, but good to set for future uses of a webworker.).
  samplesPerPixel: 3000,
  mono: false,
  waveHeight: 70,
  container: document.getElementById("playlist"),
  state: 'cursor',
  colors: {
    waveOutlineColor: '#E0EFF1',
    timeColor: 'grey',
    fadeColor: 'black'
  },
  controls: {
    show: true, //whether or not to include the track controls
    width: 200 //width of controls in pixels
  },
  zoomLevels: [500, 1000, 3000, 5000]
});

playlist.load([
  {
    "src": "media/audio/Vocals30.mp3",
    "name": "Vocals"
  },
  {
    "src": "media/audio/BassDrums30.mp3",
    "name": "Drums",
    "start": 8.5,
    "fadeIn": {
      "duration": 0.5
    },
    "fadeOut": {
      "shape": "logarithmic",
      "duration": 0.5
    }
  },
  {
    "src": "media/audio/Guitar30.mp3",
    "name": "Guitar",
    "start": 23.5,
    "fadeOut": {
      "shape": "linear",
      "duration": 0.5
    },
    "cuein": 15
  }
]).then(function() {
  //can do stuff with the playlist.
});
```

# Waveform Playlist Options

```javascript
var options = {
  //Location of the js relative to the html page. Needed for the webworker.
  jsLocation: "js/",

  //webaudio api AudioContext
  ac: new (window.AudioContext || window.webkitAudioContext),

  //DOM container element REQUIRED
  container: document.getElementById("playlist"),

  //sample rate of the project. (used for correct peaks rendering)
  sampleRate: new (window.AudioContext || window.webkitAudioContext).sampleRate,

  //number of audio samples per waveform peak.
  //must be an entry in option: zoomLevels.
  samplesPerPixel: 4096,

  //whether to draw multiple channels or combine them.
  mono: true,

  //default fade curve type.
  fadeType: 'logarithmic', // (logarithmic | linear | sCurve | exponential)

  //whether or not to include the time measure.
  timescale: false,

  //control panel on left side of waveform
  controls: {
    //whether or not to include the track controls
    show: false,
    //width of controls in pixels
    width: 150
  },

  colors: {
    //color of the wave background
    waveOutlineColor: 'white',

    //color of the time ticks on the canvas
    timeColor: 'grey',

    //color of the fade drawn on canvas
    fadeColor: 'black'
  },

  //height in pixels of each canvas element a waveform is on.
  waveHeight: 128,

  //interaction state of the playlist
  state: 'cursor', // (cursor | select | fadein | fadeout | shift)

  //Array of zoom levels in samples per pixel.
  zoomLevels: [512, 1024, 2048, 4096]
};
```

## Tests

  `npm test`

## Development

  `gulp webpack-dev-server`

  `https://localhost:8080/webpack-dev-server/index.html`

  load and run the library examples.

## Credits

Originally created for the [Airtime](https://www.sourcefabric.org/en/airtime/) project at [Sourcefabric](https://www.sourcefabric.org/)


## License

[MIT License](http://doge.mit-license.org)
