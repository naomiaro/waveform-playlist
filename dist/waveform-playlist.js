/*! waveform-playlist 0.1.0
Written by: Naomi Aro
Website: http://naomiaro.github.io/waveform-playlist
License: MIT */
var publisher = {
    subscribers: {
        any: []
    },
    on: function (type, fn, context) {
        type = type || 'any';
        fn = typeof fn === "function" ? fn : context[fn];
        
        if (typeof this.subscribers[type] === "undefined") {
            this.subscribers[type] = [];
        }
        this.subscribers[type].push({fn: fn, context: context || this});
    },
    remove: function (type, fn, context) {
        this.visitSubscribers('unsubscribe', type, fn, context);
    },
    fire: function (type, publication) {
        this.visitSubscribers('publish', type, publication);
    },
    reset: function (type) {
        this.subscribers[type] = undefined;
    },
    visitSubscribers: function (action, type, arg, context) {
        var pubtype = type || 'any',
            subscribers = this.subscribers[pubtype],
            i,
            max = subscribers ? subscribers.length : 0;
            
        for (i = 0; i < max; i += 1) {
            if (action === 'publish') {
                subscribers[i].fn.call(subscribers[i].context, arg);
            } 
            else {
                if (subscribers[i].fn === arg && subscribers[i].context === context) {
                    subscribers.splice(i, 1);
                }
            }
        }
    }
};


function makePublisher(o) {
    var i;
    for (i in publisher) {
        if (publisher.hasOwnProperty(i) && typeof publisher[i] === "function") {
            o[i] = publisher[i];
        }
    }
    o.subscribers = {any: []};
}

var Storage = function() {};

Storage.prototype.save = function save(name, playlist) {
    var json = JSON.stringify(playlist);
    console.log(json);

    localStorage.setItem(name, json);
};

Storage.prototype.restore = function restore(name) {
    var JSONstring = localStorage.getItem(name),
        data;
    console.log(JSONstring);

    data = JSON.parse(JSONstring);

    return data;
};

var Config = function(params) {

        var that = this,
            defaultParams;

        defaultParams = {

            ac: new (window.AudioContext || window.webkitAudioContext),

            resolution: 4096, //resolution - samples per pixel to draw.
            minResolution: 500,
            maxResolution: 20000,
            timeFormat: 'hh:mm:ss.uu',
            mono: true, //whether to draw multiple channels or combine them.
            fadeType: 'logarithmic',

            timescale: false, //whether or not to include the time measure.

            UITheme: "default", // bootstrap || jQueryUI || default

            waveColor: 'grey',
            progressColor: 'orange',
            loadingColor: 'purple',
            cursorColor: 'green',
            markerColor: 'green',
            selectBorderColor: 'red',
            selectBackgroundColor: 'rgba(0,0,0,0.1)',

            timeColor: 'grey',
            fontColor: 'black',
            fadeColor: 'black',

            waveHeight: 128, //height of each canvas element a waveform is on.

            trackscroll: {
                left: 0,
                top: 0
            },

            state: 'select',

            cursorPos: 0 //value is kept in seconds.
        };

        params = Object.create(params);
        Object.keys(defaultParams).forEach(function(key) {
            if (!(key in params)) { 
                params[key] = defaultParams[key]; 
            }
        });


        /*
            Start of all getter methods for config.
        */

        that.getContainer = function getContainer() {
            return params.container;
        };

        that.isTimeScaleEnabled = function isTimeScaleEnabled() {
            return params.timescale;
        };

        that.getFadeType = function getFadeType() {
            return params.fadeType;
        };

        that.isDisplayMono = function isDisplayMono() {
            return params.mono;
        };

        that.getUITheme = function getUITheme() {
            return params.UITheme;
        };

        that.getCursorPos = function getCursorPos() {
            return params.cursorPos;
        };

        that.getState = function getState() {
            return params.state;
        };

        that.getAudioContext = function getAudioContext() {
            return params.ac;
        };

        that.getSampleRate = function getSampleRate() {
            return params.ac.sampleRate;
        };

        that.getCurrentTime = function getCurrentTime() {
            return params.ac.currentTime;
        };

        that.getTimeFormat = function getTimeFormat() {
            return params.timeFormat;
        };

        that.getMinResolution = function getResolution() {
            return params.minResolution;
        };

        that.getMaxResolution = function getResolution() {
            return params.maxResolution;
        };

        that.getResolution = function getResolution() {
            return params.resolution;
        };

        that.getWaveHeight = function getWaveHeight() {
            return params.waveHeight;
        };

        that.getColorScheme = function getColorScheme() {
            return {
                waveColor: params.waveColor,
                progressColor: params.progressColor,
                loadingColor: params.loadingColor,
                cursorColor: params.cursorColor,
                markerColor: params.markerColor,
                timeColor: params.timeColor,
                fontColor: params.fontColor,
                fadeColor: params.fadeColor,
                selectBorderColor: params.selectBorderColor,
                selectBackgroundColor: params.selectBackgroundColor, 
            };
        };

        that.getTrackScroll = function getTrackScroll() {
            var scroll = params.trackscroll;
        
            return {
                left: scroll.left,
                top: scroll.top
            };
        };


        /*
            Start of all setter methods for config.
        */

        that.setResolution = function setResolution(resolution) {
            params.resolution = resolution;
        };

        that.setTimeFormat = function setTimeFormat(format) {
            params.timeFormat = format;
        };

        that.setFadeType = function setFadeType(type) {
            params.fadeType = type;
        };

        that.setDisplayMono = function setDisplayMono(bool) {
            params.mono = bool;
        };

        that.setCursorPos = function setCursorPos(pos) {
            params.cursorPos = pos;
        };

        that.setState = function setState(state) {
            params.state = state;
        };

        that.setTrackScroll = function setTrackScroll(left, top) {
            var scroll = params.trackscroll;

            scroll.left = (left !== undefined) ? left : scroll.left;
            scroll.top = (top !== undefined) ? top : scroll.top;
        };
};

var Curves = {};

Curves.createLinearBuffer = function createLinearBuffer(length, rotation) {
    var curve = new Float32Array(length),
        i, x,
        scale = length - 1;

    for (i = 0; i < length; i++) {
        x = i / scale;

        if (rotation > 0) {
            curve[i] = x;
        }
        else {
            curve[i] = 1 - x;
        }  
    }
    return curve;
};

Curves.createExponentialBuffer = function createExponentialBuffer(length, rotation) {
    var curve = new Float32Array(length),
        i, x,
        scale = length - 1,
        index;

    for (i = 0; i < length; i++) {
        x = i / scale;
        index = rotation > 0 ? i : length - 1 - i;
       
        curve[index] = Math.exp(2 * x - 1) / Math.exp(1);
    }
    return curve;
};

//creating a curve to simulate an S-curve with setValueCurveAtTime.
Curves.createSCurveBuffer = function createSCurveBuffer(length, phase) {
    var curve = new Float32Array(length),
        i;

    for (i = 0; i < length; ++i) {
        curve[i] = (Math.sin((Math.PI * i / length) - phase)) /2 + 0.5;
    }
    return curve;
};

//creating a curve to simulate a logarithmic curve with setValueCurveAtTime.
Curves.createLogarithmicBuffer = function createLogarithmicBuffer(length, base, rotation) {
    var curve = new Float32Array(length),
        index,
        key = ""+length+base+rotation,
        store = [],
        x = 0,
        i;

    if (store[key]) {
        return store[key];
    }

    for (i = 0; i < length; i++) {
        //index for the curve array.
        index = rotation > 0 ? i : length - 1 - i;

        x = i / length;
        curve[index] = Math.log(1 + base*x) / Math.log(1 + base);
    }

    store[key] = curve;

    return curve;
};


'use strict';

var WaveformDrawer = function() {

};

WaveformDrawer.prototype.init = function(container, config) {

    makePublisher(this);

    this.config = config;
    this.container = container;
    this.channels = []; //array of canvases, contexts, 1 for each channel displayed.
    this.pixelOffset = 0;

    var theme = this.config.getUITheme();

    if (this.loaderStates[theme] !== undefined) {
        this.loaderStates = this.loaderStates[theme];
    }
    else {
        this.loaderStates = this.loaderStates["default"];
    }
};

WaveformDrawer.prototype.loaderStates = {
    "bootstrap": {
        "downloading": "progress-bar",
        "decoding": "progress-bar progress-bar-striped",
        "loader": "bar"
    },
    
    "jQueryUI": {
        "downloading": "ui-progressbar ui-widget ui-widget-content ui-corner-all",
        "decoding": "ui-progressbar ui-widget ui-widget-content ui-corner-all",
        "loader": "ui-progressbar-value ui-widget-header ui-corner-left"
    },

    "default": {
        "downloading": "progress",
        "decoding": "decoding",
        "loader": "bar"
    }
};

WaveformDrawer.prototype.getPeaks = function(buffer, cues) {
    
    // Frames per pixel
    var res = this.config.getResolution(),
        peaks = [],
        i, c, p, l,
        chanLength = cues.cueout - cues.cuein,
        pixels = Math.ceil(chanLength / res),
        numChan = buffer.numberOfChannels,
        weight = 1 / (numChan),
        makeMono = this.config.isDisplayMono(),
        chan, 
        start, 
        end, 
        vals, 
        max, 
        min,
        maxPeak = -Infinity; //used to scale the waveform on the canvas.

    for (i = 0; i < pixels; i++) {
        
        peaks[i] = [];

        for (c = 0; c < numChan; c++) {

            chan = buffer.getChannelData(c);
            chan = chan.subarray(cues.cuein, cues.cueout);

            start = i * res;
            end = (i + 1) * res > chanLength ? chanLength : (i + 1) * res;
            vals = chan.subarray(start, end);
            max = -Infinity;
            min = Infinity;

            for (p = 0, l = vals.length; p < l; p++) {
                if (vals[p] > max){
                    max = vals[p];
                }
                if (vals[p] < min){
                    min = vals[p];
                }
            }
            peaks[i].push({max:max, min:min});
            maxPeak = Math.max.apply(Math, [maxPeak, Math.abs(max), Math.abs(min)]);
        }
    
        if (makeMono) {
            max = min = 0;

            for (c = 0 ; c < numChan; c++) {
                max = max + weight * peaks[i][c].max;
                min = min + weight * peaks[i][c].min;     
            }

            peaks[i] = []; //need to clear out old stuff (maybe we should keep it for toggling views?).
            peaks[i].push({max:max, min:min});
        }
    }

    this.maxPeak = maxPeak;
    this.peaks = peaks;
};

WaveformDrawer.prototype.setPixelOffset = function(pixels) {
    this.pixelOffset = pixels;
    this.drawTimeShift();
};

WaveformDrawer.prototype.drawTimeShift = function() {
    var i, len;

    for (i = 0, len = this.channels.length; i < len; i++) {
        this.channels[i].div.style.left = this.pixelOffset+"px";
    } 
};

WaveformDrawer.prototype.updateLoader = function(percent) {
    this.loader.style.width = percent+"%";
};

WaveformDrawer.prototype.setLoaderState = function(state) {
    this.loader.className = this.loaderStates[state];
};

WaveformDrawer.prototype.drawLoading = function() {
    var div,
        loader;

    this.height = this.config.getWaveHeight();

    div = document.createElement("div");
    div.style.height = this.height+"px";
    
    loader = document.createElement("div");
    loader.style.height = "10px";
    loader.className = this.loaderStates["loader"];

    div.appendChild(loader);
    this.loader = loader;

    this.setLoaderState("downloading");
    this.updateLoader(0);

    this.container.appendChild(div);
};

WaveformDrawer.prototype.drawBuffer = function(buffer, cues) {
    var canv,
        div,
        progress,
        cursor,
        surface,
        i,
        top = 0,
        left = 0,
        makeMono = this.config.isDisplayMono(),
        res = this.config.getResolution(),
        numChan = makeMono? 1 : buffer.numberOfChannels,
        numSamples = cues.cueout - cues.cuein + 1,
        fragment = document.createDocumentFragment(),
        colors = this.config.getColorScheme(),
        wrapperHeight; 

    this.container.innerHTML = "";
    this.channels = [];  

    //width and height is per waveform canvas.
    this.width = Math.ceil(numSamples / res);
    this.height = this.config.getWaveHeight();

    for (i = 0; i < numChan; i++) {

        div = document.createElement("div");
        div.classList.add("channel");
        div.classList.add("channel-"+i);
        div.style.width = this.width+"px";
        div.style.height = this.height+"px";
        div.style.top = top+"px";
        div.style.left = left+"px";
        div.style.background = colors.waveColor;

        canv = document.createElement("canvas");
        canv.setAttribute('width', this.width);
        canv.setAttribute('height', this.height);

        progress = document.createElement("div");
        progress.classList.add("channel-progress");
        progress.style.background = colors.progressColor;
        progress.style.width = 0;
        progress.style.height = this.height+"px";

        surface = document.createElement("canvas");
        surface.setAttribute('width', this.width);
        surface.setAttribute('height', this.height);

        this.channels.push({
            context: canv.getContext('2d'),
            div: div,
            progress: progress,
            surface: surface.getContext('2d')
        });

        div.appendChild(canv);
        div.appendChild(progress);
        div.appendChild(surface);
        fragment.appendChild(div);

        top = top + this.height;
    }

    cursor = document.createElement("div");
    cursor.classList.add("cursor");
    cursor.style.position = "absolute";
    cursor.style.top = 0;
    cursor.style.left = 0;
    cursor.style.bottom = 0;
    cursor.style.borderRight = "1px solid #000";

    this.cursor = cursor;

    fragment.appendChild(cursor);
  
    wrapperHeight = numChan * this.height;
    this.container.style.height = wrapperHeight+"px";
    this.container.appendChild(fragment);
    
    this.getPeaks(buffer, cues);
    this.draw();
    this.drawTimeShift();
};

WaveformDrawer.prototype.drawFrame = function(chanNum, index, peak) {
    var x, y, w, h, max, min,
        h2 = this.height / 2,
        cc = this.channels[chanNum].context,
        colors = this.config.getColorScheme();

    max = Math.abs((peak.max / this.maxPeak) * h2);
    min = Math.abs((peak.min / this.maxPeak) * h2);

    w = 1;
    x = index * w;
    
    cc.fillStyle = 'white';

    //draw maxs
    cc.fillRect(x, 0, w, h2-max);
    //draw mins
    cc.fillRect(x, h2+min, w, h2-min);
};

/*
    start, end are optional parameters to only redraw part of the canvas.
*/
WaveformDrawer.prototype.draw = function(start, end) {
    var that = this,
        peaks = this.peaks,
        pixelOffset = this.pixelOffset,
        i = (start) ? start - pixelOffset : 0,
        len = (end) ? end - pixelOffset + 1 : peaks.length;

    if (i < 0 && len < 0) {
        return;
    } 

    if (i < 0) {
        i = 0;
    }

    if (len > peaks.length) {
        len = peaks.length;
    }

    for (; i < len; i++) {

        peaks[i].forEach(function(peak, chanNum) {
            that.drawFrame(chanNum, i, peak);
        });
    } 
};

/*
    Clear the surface canvas where cursors, selections, envelopes etc will be drawn.
*/
WaveformDrawer.prototype.clear = function() {
    var i, len;

    for (i = 0, len = this.channels.length; i < len; i++) {
        this.channels[i].surface.clearRect(0, 0, this.width, this.height);
    }
};

/*
    set width of progress box according to cursor position (in pixels).
*/
WaveformDrawer.prototype.updateProgress = function(cursorPos) {
    this.drawProgress(cursorPos);
    this.drawCursor(cursorPos);
};

WaveformDrawer.prototype.drawProgress = function(cursorPos) {
    var i, len,
        currentWidth = Math.max(cursorPos - this.pixelOffset, 0),
        width = Math.min(currentWidth, this.width);

    for (i = 0, len = this.channels.length; i < len; i++) {
        this.channels[i].progress.style.width = width+"px";
    }
};

WaveformDrawer.prototype.drawCursor = function(cursorPos) {
    this.cursor.style.width = cursorPos+"px";
};

/*
    start, end in pixels.
*/
WaveformDrawer.prototype.drawHighlight = function(start, end) {
    var i, len,
        colors = this.config.getColorScheme(),
        fillStyle,
        ctx,
        width = end - start + 1,
        isBorder;

    fillStyle = (width === 1) ? colors.selectBorderColor : colors.selectBackgroundColor;
    this.clear();

    for (i = 0, len = this.channels.length; i < len; i++) {
        ctx = this.channels[i].surface;
        ctx.fillStyle = fillStyle;
        ctx.fillRect(start, 0, width, this.height);
    }
};

WaveformDrawer.prototype.sCurveFadeIn = function sCurveFadeIn(ctx, width) {
    return Curves.createSCurveBuffer(width, (Math.PI/2));
};

WaveformDrawer.prototype.sCurveFadeOut = function sCurveFadeOut(ctx, width) {
    return Curves.createSCurveBuffer(width, -(Math.PI/2));  
};

WaveformDrawer.prototype.logarithmicFadeIn = function logarithmicFadeIn(ctx, width) {
    return Curves.createLogarithmicBuffer(width, 10, 1);
};

WaveformDrawer.prototype.logarithmicFadeOut = function logarithmicFadeOut(ctx, width) {
    return Curves.createLogarithmicBuffer(width, 10, -1);  
};

WaveformDrawer.prototype.exponentialFadeIn = function exponentialFadeIn(ctx, width) {
    return Curves.createExponentialBuffer(width, 1);
};

WaveformDrawer.prototype.exponentialFadeOut = function exponentialFadeOut(ctx, width) {
    return Curves.createExponentialBuffer(width, -1);  
};

WaveformDrawer.prototype.linearFadeIn = function linearFadeIn(ctx, width) {
    return Curves.createLinearBuffer(width, 1);
};

WaveformDrawer.prototype.linearFadeOut = function linearFadeOut(ctx, width) {
    return Curves.createLinearBuffer(width, -1);  
};

WaveformDrawer.prototype.drawFadeCurve = function(ctx, shape, type, width) {
    var method = shape+type,
        fn = this[method],
        colors = this.config.getColorScheme(),
        curve,
        i, len,
        cHeight = this.height,
        y;

    ctx.strokeStyle = colors.fadeColor;

    curve = fn.call(this, ctx, width);

    y = cHeight - curve[0] * cHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);

    for (i = 1, len = curve.length; i < len; i++) {
        y = cHeight - curve[i] * cHeight;
        ctx.lineTo(i, y);
    }
    ctx.stroke();
};

WaveformDrawer.prototype.removeFade = function(id) {
    var fadeClass = "playlist-fade-"+id,
        el, els,
        i,len;

    els = this.container.getElementsByClassName(fadeClass);
    len = els.length;

    //DOM NodeList is live, use a decrementing counter.
    if (len > 0) {
        for (i = len-1; i >= 0; i--) {
            el = els[i];
            el.parentNode.removeChild(el);
        }    
    }
};

WaveformDrawer.prototype.drawFade = function(id, type, shape, start, end) {
    var div,
        canv,
        width,
        left,
        fragment = document.createDocumentFragment(),
        i, len,
        dup,
        ctx,
        tmpCtx;

    if ((end - start) === 0) {
        return;
    } 

    width = ~~(end - start + 1);
    left = start;

    div = document.createElement("div");
    div.classList.add("playlist-fade");
    div.classList.add("playlist-fade-"+id);
    div.style.width = width+"px";
    div.style.height = this.height+"px";
    div.style.top = 0;
    div.style.left = left+"px";

    canv = document.createElement("canvas");
    canv.setAttribute('width', width);
    canv.setAttribute('height', this.height);
    ctx = canv.getContext('2d');

    this.drawFadeCurve(ctx, shape, type, width);

    div.appendChild(canv);
    fragment.appendChild(div);   
      
    for (i = 0, len = this.channels.length; i < len; i++) {
        dup = fragment.cloneNode(true);
        tmpCtx = dup.querySelector('canvas').getContext('2d');
        tmpCtx.drawImage(canv, 0, 0);

        this.channels[i].div.appendChild(dup);
    }
};

WaveformDrawer.prototype.drawFades = function(fades) {
    var id,
        fade,
        startPix,
        endPix,
        SR = this.config.getSampleRate(),
        res = this.config.getResolution();

    for (id in fades) {
        fade = fades[id];

        if (fades.hasOwnProperty(id)) {
            startPix = fade.start * SR / res;
            endPix = fade.end * SR / res;
            this.drawFade(id, fade.type, fade.shape, startPix, endPix);
        }
    }
};


var Fades = function() {};

Fades.prototype.init = function init(sampleRate) {
    
    this.sampleRate = sampleRate;  
}

/*
The setValueCurveAtTime method
Sets an array of arbitrary parameter values starting at the given time for the given duration. The number of values will be scaled to fit into the desired duration.

The values parameter is a Float32Array representing a parameter value curve. These values will apply starting at the given time and lasting for the given duration.

The startTime parameter is the time in the same time coordinate system as AudioContext.currentTime.

The duration parameter is the amount of time in seconds (after the time parameter) where values will be calculated according to the values parameter..

During the time interval: startTime <= t < startTime + duration, values will be calculated:

      v(t) = values[N * (t - startTime) / duration], where N is the length of the values array.
      
After the end of the curve time interval (t >= startTime + duration), the value will remain constant at the final curve value, until there is another automation event (if any).
*/
   
Fades.prototype.sCurveFadeIn = function sCurveFadeIn(gain, start, duration, options) {
    var curve;
        
    curve = Curves.createSCurveBuffer(this.sampleRate, (Math.PI/2));
    gain.setValueCurveAtTime(curve, start, duration);
};

Fades.prototype.sCurveFadeOut = function sCurveFadeOut(gain, start, duration, options) {
    var curve;
        
    curve = Curves.createSCurveBuffer(this.sampleRate, -(Math.PI/2));
    gain.setValueCurveAtTime(curve, start, duration);
};

/*

The linearRampToValueAtTime method
Schedules a linear continuous change in parameter value from the previous scheduled parameter value to the given value.

The value parameter is the value the parameter will linearly ramp to at the given time.

The endTime parameter is the time in the same time coordinate system as AudioContext.currentTime.

The value during the time interval T0 <= t < T1 (where T0 is the time of the previous event and T1 is the endTime parameter passed into this method) will be calculated as:

      v(t) = V0 + (V1 - V0) * ((t - T0) / (T1 - T0))
      
Where V0 is the value at the time T0 and V1 is the value parameter passed into this method.

If there are no more events after this LinearRampToValue event then for t >= T1, v(t) = V1

*/
Fades.prototype.linearFadeIn = function linearFadeIn(gain, start, duration, options) {

    gain.linearRampToValueAtTime(0, start);
    gain.linearRampToValueAtTime(1, start + duration);
};

Fades.prototype.linearFadeOut = function linearFadeOut(gain, start, duration, options) {

    gain.linearRampToValueAtTime(1, start);
    gain.linearRampToValueAtTime(0, start + duration);
};

/*
DOES NOT WORK PROPERLY USING 0

The exponentialRampToValueAtTime method
Schedules an exponential continuous change in parameter value from the previous scheduled parameter value to the given value. Parameters representing filter frequencies and playback rate are best changed exponentially because of the way humans perceive sound.

The value parameter is the value the parameter will exponentially ramp to at the given time. An exception will be thrown if this value is less than or equal to 0, or if the value at the time of the previous event is less than or equal to 0.

The endTime parameter is the time in the same time coordinate system as AudioContext.currentTime.

The value during the time interval T0 <= t < T1 (where T0 is the time of the previous event and T1 is the endTime parameter passed into this method) will be calculated as:

      v(t) = V0 * (V1 / V0) ^ ((t - T0) / (T1 - T0))
      
Where V0 is the value at the time T0 and V1 is the value parameter passed into this method.

If there are no more events after this ExponentialRampToValue event then for t >= T1, v(t) = V1
*/
Fades.prototype.exponentialFadeIn = function exponentialFadeIn(gain, start, duration, options) {

    gain.exponentialRampToValueAtTime(0.01, start);
    gain.exponentialRampToValueAtTime(1, start + duration);
};

Fades.prototype.exponentialFadeOut = function exponentialFadeOut(gain, start, duration, options) {

    gain.exponentialRampToValueAtTime(1, start);
    gain.exponentialRampToValueAtTime(0.01, start + duration);
};

Fades.prototype.logarithmicFadeIn = function logarithmicFadeIn(gain, start, duration, options) {
    var curve,
        base = options.base;

    base = typeof base !== 'undefined' ? base : 10;

    curve = Curves.createLogarithmicBuffer(this.sampleRate, base, 1);
    gain.setValueCurveAtTime(curve, start, duration);
};

Fades.prototype.logarithmicFadeOut = function logarithmicFadeOut(gain, start, duration, options) {
    var curve,
        base = options.base;

    base = typeof base !== 'undefined' ? base : 10;

    curve = Curves.createLogarithmicBuffer(this.sampleRate, base, -1);
    gain.setValueCurveAtTime(curve, start, duration);
};

/**
    Calls the appropriate fade type with options

    options {
        start,
        duration,
        base (for logarithmic)
    }
*/
Fades.prototype.createFadeIn = function createFadeIn(gain, type, options) {
    var method = type + "FadeIn",
        fn = this[method];

    fn.call(this, gain, options.start, options.duration, options);
};

Fades.prototype.createFadeOut = function createFadeOut(gain, type, options) {
    var method = type + "FadeOut",
        fn = this[method];

    fn.call(this, gain, options.start, options.duration, options);
};

'use strict';

var AudioPlayout = function() {

};

AudioPlayout.prototype.init = function(config) {

    makePublisher(this);

    this.config = config;
    this.ac = this.config.getAudioContext();

    this.fadeMaker = new Fades();
    this.fadeMaker.init(this.ac.sampleRate);
    
    this.fadeGain = undefined;
    this.destination = this.ac.destination;
};

AudioPlayout.prototype.getBuffer = function() {
    return this.buffer;
};

/*
    param relPos: cursor position in seconds relative to this track.
        can be negative if the cursor is placed before the start of this track etc.
*/
AudioPlayout.prototype.applyFades = function(fades, relPos, now) {
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

    this.fadeGain.disconnect();
    this.fadeGain = undefined;
};

AudioPlayout.prototype.setUpSource = function() {
    this.source = this.ac.createBufferSource();
    this.source.buffer = this.buffer;

    //keep track of the buffer state.
    this.source.onended = this.onSourceEnded.bind(this);

    this.source.connect(this.fadeGain);
    this.fadeGain.connect(this.destination);
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

    this.setUpSource();
    this.source.start(when || 0, start, duration);
};

AudioPlayout.prototype.stop = function(when) {
 
    this.source && this.source.stop(when || 0);
};


'use strict';

var TrackEditor = function() {

};

TrackEditor.prototype.classes = {
    "cursor": [
        "state-select"
    ],

    "select": [
        "state-select"
    ],

    "fadein": [
        "state-select"
    ],

    "fadeout": [
        "state-select"
    ],

    "shift": [
        "state-shift"
    ],

    "active": [
        "active"
    ],

    "disabled": [
        "disabled"
    ]
};

TrackEditor.prototype.events = {
    "cursor": {
        "mousedown": "selectCursorPos"
    },

    "select": {
        "mousedown": "selectStart"
    },

    "fadein": {
        "mousedown": "selectFadeIn"
    },

    "fadeout": {
        "mousedown": "selectFadeOut"
    },

    "shift": {
        "mousedown": "timeShift"
    }
};

TrackEditor.prototype.setConfig = function(config) {
    this.config = config;
};

//value leftOffset is measured in samples.
TrackEditor.prototype.setLeftOffset = function(offset) {
    this.leftOffset = offset;
    this.drawer.setPixelOffset(offset / this.resolution);
};

TrackEditor.prototype.init = function(src, start, end, fades, cues, stateConfig) {

    var statesEnabled = {
        'cursor': true,
        'fadein': true,
        'fadeout': true,
        'select': true,
        'shift': true
    };

    //extend enabled states config.
    Object.keys(statesEnabled).forEach(function (key) {
        statesEnabled[key] = (key in stateConfig) ? stateConfig[key] : statesEnabled[key];
    });

    this.enabledStates = statesEnabled;
   
    makePublisher(this);

    this.container = document.createElement("div");

    this.drawer = new WaveformDrawer();
    this.drawer.init(this.container, this.config);

    this.playout = new AudioPlayout();
    this.playout.init(this.config);

    this.sampleRate = this.config.getSampleRate();
    this.resolution = this.config.getResolution();

    //value is a float in seconds
    this.startTime = start || 0;
    //value is a float in seconds
    this.endTime = end || 0; //set properly in onTrackLoad.

    this.setLeftOffset(this.secondsToSamples(this.startTime));

    this.prevStateEvents = {};
    this.setState(this.config.getState());

    this.fades = {};
    if (fades !== undefined && fades.length > 0) {
    
        for (var i = 0; i < fades.length; i++) {
            this.fades[this.getFadeId()] = fades[i];
        }
    }
    
    if (cues.cuein !== undefined) {
        this.setCuePoints(this.secondsToSamples(cues.cuein), this.secondsToSamples(cues.cueout));
    }
    
    this.active = false;
    this.selectedArea = undefined; //selected area of track stored as inclusive buffer indices to the audio buffer.
    this.container.classList.add("channel-wrapper");
    this.drawer.drawLoading();

    return this.container;
};

TrackEditor.prototype.getFadeId = function() {
    var id = ""+Math.random();

    return id.replace(".", "");
};

TrackEditor.prototype.getBuffer = function() {
    return this.playout.getBuffer();
};

TrackEditor.prototype.loadTrack = function(track) {
    var el;

    el = this.init(
        track.src, 
        track.start, 
        track.end, 
        track.fades,
        {
            cuein: track.cuein,
            cueout: track.cueout
        },
        track.states || {}
    );

    if (track.selected !== undefined) {
        this.selectedArea = {
            start: this.secondsToSamples(track.selected.start),
            end: this.secondsToSamples(track.selected.end)
        };
    }

    this.loadBuffer(track.src);

    return el;
};

/**
 * Loads an audio file via XHR.
 */
TrackEditor.prototype.loadBuffer = function(src) {
    var that = this,
        xhr = new XMLHttpRequest();

    xhr.open('GET', src, true);
    xhr.responseType = 'arraybuffer';

    xhr.addEventListener('progress', function(e) {
        var percentComplete;

        if (e.lengthComputable) {
            percentComplete = e.loaded / e.total * 100;
            that.drawer.updateLoader(percentComplete);
        } 

    }, false);

    xhr.addEventListener('load', function(e) {
        that.src = src;
        that.drawer.setLoaderState("decoding");

        that.playout.loadData(
            e.target.response,
            that.onTrackLoad.bind(that)
        );
    }, false);

    xhr.send();
};

TrackEditor.prototype.drawTrack = function(buffer) {

    this.drawer.drawBuffer(buffer, this.cues);
    this.drawer.drawFades(this.fades);
};

TrackEditor.prototype.onTrackLoad = function(buffer, err) {
    var res,
        startTime,
        endTime;

    if (err !== undefined) {
        this.container.innerHTML = "";
        this.container.classList.add("error");

        this.fire('unregister');

        return;
    }

    if (this.cues === undefined) {
        this.setCuePoints(0, buffer.length - 1);
    }
    //adjust if the length was inaccurate and cueout is set to a higher sample than we actually have.
    else if (this.cues.cueout > (buffer.length - 1)) {
        this.cues.cueout = buffer.length - 1;
    }

    if (this.width !== undefined) {
        res = Math.ceil(buffer.length / this.width);

        this.config.setResolution(res);
        this.resolution = res;
    }
   
    this.drawTrack(buffer);

    if (this.selectedArea !== undefined) {
        startTime = this.samplesToSeconds(this.selectedArea.start);
        endTime = this.samplesToSeconds(this.selectedArea.end);

        this.config.setCursorPos(startTime);
        this.notifySelectUpdate(startTime, endTime);
    }
};

TrackEditor.prototype.samplesToSeconds = function(samples) {
    return samples / this.sampleRate;
};

TrackEditor.prototype.secondsToSamples = function(seconds) {
    return Math.ceil(seconds * this.sampleRate);
};

TrackEditor.prototype.samplesToPixels = function(samples) {
    return ~~(samples / this.resolution);
};

TrackEditor.prototype.pixelsToSamples = function(pixels) {
    return ~~(pixels * this.resolution);
};

TrackEditor.prototype.pixelsToSeconds = function(pixels) {
    return pixels * this.resolution / this.sampleRate;
};

TrackEditor.prototype.secondsToPixels = function(seconds) {
    return ~~(seconds * this.sampleRate / this.resolution);
};

TrackEditor.prototype.activate = function() {
    this.active = true;
    this.container.classList.add("active");
};

TrackEditor.prototype.deactivate = function() {
    this.active = false;
    this.selectedArea = undefined;
    this.container.classList.remove("active");
    this.drawer.clear();
};

/*
    startTime, endTime in seconds.
*/
TrackEditor.prototype.notifySelectUpdate = function(startTime, endTime) {
    this.fire('changecursor', {
        start: startTime,
        end: endTime,
        editor: this
    });
};


TrackEditor.prototype.getSelectedPlayTime = function() {
    var selected = this.selectedArea,
        offset = this.leftOffset,
        start = this.samplesToSeconds(offset + selected.start),
        end = this.samplesToSeconds(offset + selected.end);

    return {
        startTime: start,
        endTime: end
    }
};


TrackEditor.prototype.getSelectedArea = function() {
    return this.selectedArea;
};

/*
    start, end in samples. (relative to cuein/cueout)
*/
TrackEditor.prototype.adjustSelectedArea = function(start, end) {
    var buffer = this.getBuffer(),
        cues = this.cues;

    if (start === undefined || start < 0) {
        start = 0;
    }

    if (end === undefined) {
        end = cues.cueout - cues.cuein;
    }

    if (end > buffer.length - 1) {
        end = buffer.length - 1;
    }

    return {
        start: start,
        end: end
    };
};

/*
    start, end in pixels
*/
TrackEditor.prototype.setSelectedArea = function(start, end, shiftKey) {
    var left, 
        right,
        currentStart,
        currentEnd,
        sampLeft,
        sampRight,
        buffer = this.getBuffer();

    //extending selected area since shift is pressed.
    if (shiftKey && (end - start === 0) && (this.prevSelectedArea !== undefined)) {

        currentStart = this.samplesToPixels(this.prevSelectedArea.start);
        currentEnd = this.samplesToPixels(this.prevSelectedArea.end);

        if (start < currentStart) {
            left = start;
            right = currentEnd;
        }
        else if (end > currentEnd) {
            left = currentStart;
            right = end;
        }
        //it's ambigous otherwise, cut off the smaller duration.
        else {
            if ((start - currentStart) < (currentEnd - start)) {
                left = start;
                right = currentEnd;
            }
            else {
                left = currentStart;
                right = end;
            }
        }
    }
    else {
        left = start;
        right = end;
    }

    sampLeft = left === undefined ? undefined : this.pixelsToSamples(left);
    sampRight = right === undefined ? undefined : this.pixelsToSamples(right);

    this.prevSelectedArea = this.selectedArea;
    this.selectedArea = this.adjustSelectedArea(sampLeft, sampRight);

    this.showSelection();
};

TrackEditor.prototype.activateAudioSelection = function() {

    this.fire("activateSelection");
};

TrackEditor.prototype.deactivateAudioSelection = function() {

    this.fire("deactivateSelection");
};

/*
    check to make sure a canvas was clicked not the channel wrapper
    returns -1 if it's not a canvas
*/
TrackEditor.prototype.findLayerOffset = function(e) {
    var layerOffset = 0,
        parent;

    if (e.target.tagName !== "CANVAS") {
        layerOffset = -1;
    }
    else {
        //have to check if a fade canvas was selected. (Must add left offset)
        parent = e.target.parentNode;

        if (parent.classList.contains('playlist-fade')) {
            layerOffset = parent.offsetLeft;
        }
    }

    return layerOffset;
};

/* start of state methods */

/*
    mousedown event in 'shift' mode
*/
TrackEditor.prototype.timeShift = function(e) {
    e.preventDefault();

    var el = this.container, //want the events placed on the channel wrapper.
        editor = this,
        startX = e.pageX, 
        diffX = 0, 
        updatedX = 0,
        origX = editor.leftOffset / editor.resolution,
        complete;

    //dynamically put an event on the element.
    el.onmousemove = function(e) {
        e.preventDefault();

        var endX = e.pageX;
        
        diffX = endX - startX;
        updatedX = origX + diffX;
        editor.setLeftOffset(editor.pixelsToSamples(updatedX));
    };

    complete = function(e) {
        e.preventDefault();

        var delta = editor.pixelsToSeconds(diffX);

        el.onmousemove = el.onmouseup = el.onmouseleave = null;
        editor.setLeftOffset(editor.pixelsToSamples(updatedX));

        //update track's start and end time relative to the playlist.
        editor.startTime = editor.startTime + delta;
        editor.endTime = editor.endTime + delta;
    };

    el.onmouseup = el.onmouseleave = complete;
};

/*
    This is used when in 'select' state as a mousedown event
*/
TrackEditor.prototype.selectStart = function(e) {
    e.preventDefault();

    var el = this.container, //want the events placed on the channel wrapper.
        editor = this,
        startX = e.layerX || e.offsetX, //relative to e.target (want the canvas).
        prevX = e.layerX || e.offsetX,
        offset = this.leftOffset,
        startTime,
        layerOffset,
        complete;

    layerOffset = this.findLayerOffset(e);
    if (layerOffset < 0) {
        return;
    }
    startX = startX + layerOffset;
    prevX = prevX + layerOffset;

    editor.setSelectedArea(startX, startX);
    startTime = editor.samplesToSeconds(offset + editor.selectedArea.start);

    editor.notifySelectUpdate(startTime, startTime);

    //dynamically put an event on the element.
    el.onmousemove = function(e) {
        e.preventDefault();

        var currentX = layerOffset + (e.layerX || e.offsetX),
            delta = currentX - prevX,
            minX = Math.min(prevX, currentX, startX),
            maxX = Math.max(prevX, currentX, startX),
            selectStart,
            selectEnd,
            startTime, endTime;
        
        if (currentX > startX) {
            selectStart = startX;
            selectEnd = currentX;
        }
        else {
            selectStart = currentX;
            selectEnd = startX;
        }

        startTime = editor.samplesToSeconds(offset + editor.selectedArea.start);
        endTime = editor.samplesToSeconds(offset + editor.selectedArea.end);

        editor.setSelectedArea(selectStart, selectEnd);
        editor.notifySelectUpdate(startTime, endTime);
        prevX = currentX;
    };

    complete = function(e) {
        e.preventDefault();

        var endX = layerOffset + (e.layerX || e.offsetX),
            minX, maxX,
            startTime, endTime;

        minX = Math.min(startX, endX);
        maxX = Math.max(startX, endX);

        editor.setSelectedArea(minX, maxX, e.shiftKey);

        minX = editor.samplesToPixels(offset + editor.selectedArea.start);
        maxX = editor.samplesToPixels(offset + editor.selectedArea.end);

        el.onmousemove = el.onmouseup = el.onmouseleave = null;
        
        //if more than one pixel is selected, listen to possible fade events.
        if (Math.abs(minX - maxX)) {
            editor.activateAudioSelection();
        }
        else {
            editor.deactivateAudioSelection();
        }

        startTime = editor.samplesToSeconds(offset + editor.selectedArea.start);
        endTime = editor.samplesToSeconds(offset + editor.selectedArea.end);

        editor.config.setCursorPos(startTime);
        editor.notifySelectUpdate(startTime, endTime);    
    };

    el.onmouseup = el.onmouseleave = complete;
};

/*
    This is used when in 'cursor' state as a mousedown event
*/
TrackEditor.prototype.selectCursorPos = function(e) {
    var editor = this,
        startX = e.layerX || e.offsetX, //relative to e.target (want the canvas).
        offset = this.leftOffset,
        startTime, 
        endTime,
        layerOffset;

    layerOffset = this.findLayerOffset(e);
    if (layerOffset < 0) {
        return;
    }
    startX = startX + layerOffset;

    editor.setSelectedArea(startX, startX);
    startTime = editor.samplesToSeconds(offset + editor.selectedArea.start);
    endTime = editor.samplesToSeconds(offset + editor.selectedArea.end);

    editor.config.setCursorPos(startTime);
    editor.notifySelectUpdate(startTime, endTime);

    editor.deactivateAudioSelection();
};

TrackEditor.prototype.selectFadeIn = function(e) {
    var startX = e.layerX || e.offsetX, //relative to e.target (want the canvas).
        layerOffset,
        FADETYPE = "FadeIn",
        shape = this.config.getFadeType();

    layerOffset = this.findLayerOffset(e);
    if (layerOffset < 0) {
        return;
    }
    startX = startX + layerOffset;

    this.setSelectedArea(undefined, startX);
    this.removeFadeType(FADETYPE);
    this.createFade(FADETYPE, shape);
};

TrackEditor.prototype.selectFadeOut = function(e) {
    var startX = e.layerX || e.offsetX, //relative to e.target (want the canvas).
        layerOffset,
        FADETYPE = "FadeOut",
        shape = this.config.getFadeType();

    layerOffset = this.findLayerOffset(e);
    if (layerOffset < 0) {
        return;
    }
    startX = startX + layerOffset;

    this.setSelectedArea(startX, undefined);
    this.removeFadeType(FADETYPE);
    this.createFade(FADETYPE, shape);
};

/* end of state methods */

TrackEditor.prototype.saveFade = function(id, type, shape, start, end) {
    
    this.fades[id] = {
        type: type,
        shape: shape,
        start: start,
        end: end
    };

    return id;
};

TrackEditor.prototype.removeFade = function(id) {

    delete this.fades[id];
    this.drawer.removeFade(id);
};

TrackEditor.prototype.removeFadeType = function(type) {
    var id,
        fades = this.fades,
        fade;

    for (id in fades) {
        fade = fades[id];

        if (fade.type === type) {
            this.removeFade(id);
        }
    }
};

/*
    Cue points are stored internally in the editor as sample indices for highest precision.

    sample at index cueout is not included.
*/
TrackEditor.prototype.setCuePoints = function(cuein, cueout) {
    var offset = this.cues ? this.cues.cuein : 0;

    this.cues = {
        cuein: offset + cuein,
        cueout: offset + cueout
    };

    this.duration = (cueout - cuein) / this.sampleRate;
    this.endTime = this.duration + this.startTime;
};

/*
    Will remove all audio samples from the track's buffer except for the currently selected area.
    Used to set cuein / cueout points in the audio.

    start, end are indices into the audio buffer and are inclusive.
*/
TrackEditor.prototype.trim = function(start, end) {
    
    this.setCuePoints(start, end+1);
    this.resetCursor();
    this.fades = {};
    this.drawTrack(this.getBuffer());
};

TrackEditor.prototype.onTrackEdit = function(event) {
    var type = event.type,
        method = "on" + type.charAt(0).toUpperCase() + type.slice(1);

    if (this.active === true) {
        this[method].call(this, event.args);
    }
};

TrackEditor.prototype.createFade = function(type, shape) {
    var selected = this.selectedArea,
        start = this.samplesToPixels(selected.start),
        end = this.samplesToPixels(selected.end),
        startTime = this.samplesToSeconds(selected.start),
        endTime = this.samplesToSeconds(selected.end),
        id = this.getFadeId();

    this.resetCursor();
    this.saveFade(id, type, shape, startTime, endTime);
    this.drawer.drawFade(id, type, shape, start, end);
};

TrackEditor.prototype.onCreateFade = function(args) {
    this.createFade(args.type, args.shape);
    this.deactivateAudioSelection();
};

TrackEditor.prototype.onTrimAudio = function() {
    var selected = this.getSelectedArea();

    this.trim(selected.start, selected.end);
    this.deactivateAudioSelection();
};

TrackEditor.prototype.setState = function(state) {
    var that = this,
        stateEvents = this.events[state],
        stateClasses = this.classes[state],
        disabledClasses = this.classes['disabled'],
        enabledStates = this.enabledStates,
        container = this.container,
        prevState = this.currentState,
        prevStateClasses,
        prevStateEvents = this.prevStateEvents,
        func, event, cl,
        i, len;

    if (prevState) {
        prevStateClasses = this.classes[prevState];
       
        if (enabledStates[prevState] === true) {
            for (event in prevStateEvents) {
                container.removeEventListener(event, prevStateEvents[event]);
            }
            this.prevStateEvents = {};

            for (i = 0, len = prevStateClasses.length; i < len; i++) {
                container.classList.remove(prevStateClasses[i]);
            }
        }
        else {
            for (i = 0, len = disabledClasses.length; i < len; i++) {
                container.classList.remove(disabledClasses[i]);
            }
        }  
    }

    if (enabledStates[state] === true) {
        for (event in stateEvents) {
            func = that[stateEvents[event]].bind(that);
            //need to keep track of the added events for later removal since a new function is returned after using "bind"
            this.prevStateEvents[event] = func;
            container.addEventListener(event, func);
        }
        for (i = 0, len = stateClasses.length; i < len; i++) {
            container.classList.add(stateClasses[i]);
        }
    }
    else {
        for (i = 0, len = disabledClasses.length; i < len; i++) {
            container.classList.add(disabledClasses[i]);
        }
    }

    this.currentState = state;
};

TrackEditor.prototype.onResolutionChange = function(res) {
    var selected = this.selectedArea;

    this.resolution = res;
    this.drawTrack(this.getBuffer());
    this.drawer.setPixelOffset(this.leftOffset / res);

    if (this.active === true && this.selectedArea !== undefined) {
        
        this.drawer.drawHighlight(this.samplesToPixels(selected.start), this.samplesToPixels(selected.end));
    }
};

TrackEditor.prototype.isPlaying = function() {
    return this.playout.isPlaying();
};

/*
    startTime, endTime in seconds (float).
    segment is for a highlighted section in the UI.
*/
TrackEditor.prototype.schedulePlay = function(now, startTime, endTime) { 
    var start,
        duration,
        relPos,
        when = now,
        segment = (endTime) ? (endTime - startTime) : undefined,
        cueOffset = this.cues.cuein / this.sampleRate;

    //track has no content to play.
    if (this.endTime <= startTime) return;

    //track does not play in this selection.
    if (segment && (startTime + segment) < this.startTime) return;


    //track should have something to play if it gets here.

    //the track starts in the future or on the cursor position
    if (this.startTime >= startTime) {
        start = 0;
        when = when + this.startTime - startTime; //schedule additional delay for this audio node.

        if (endTime) {
            segment = segment - (this.startTime - startTime);
            duration = Math.min(segment, this.duration);
        }
        else {
            duration = this.duration;
        }
    }
    else {
        start = startTime - this.startTime;

        if (endTime) {
            duration = Math.min(segment, this.duration - start);
        }
        else {
            duration = this.duration - start;
        }
    }

    start = start + cueOffset;

    relPos = startTime - this.startTime;
    this.playout.applyFades(this.fades, relPos, now);
    this.playout.play(when, start, duration);
};

TrackEditor.prototype.scheduleStop = function(when) {
   
    this.playout.stop(when);
};

TrackEditor.prototype.resetCursor = function() {
    this.selectedArea = undefined;
    this.config.setCursorPos(0);
    this.drawer.clear();
    this.notifySelectUpdate(0, 0);
};

TrackEditor.prototype.showProgress = function(cursorPos) {
    this.drawer.updateProgress(cursorPos);
};

TrackEditor.prototype.showSelection = function() {
    var start,
        end;

    start = this.samplesToPixels(this.selectedArea.start);
    end = this.samplesToPixels(this.selectedArea.end);

    this.drawer.drawHighlight(start, end);
};

TrackEditor.prototype.getTrackDetails = function() {
    var d,
        cues = this.cues,
        fades = [],
        id;

    for (id in this.fades) {
        fades.push(this.fades[id]);
    }

    d = {
        start: this.startTime,
        end: this.endTime,
        fades: fades,
        src: this.src,
        cuein: this.samplesToSeconds(cues.cuein),
        cueout: this.samplesToSeconds(cues.cueout)
    };

    return d;
};


'use strict';

var TimeScale = function() {

};

TimeScale.prototype.init = function(config) {

    var that = this,
        canv,
        div,
        resizeTimer;

    makePublisher(this);

    div = document.getElementsByClassName("playlist-time-scale")[0];

    if (div === undefined) {
        return;
    }
    
    canv = document.createElement("canvas");
    this.canv = canv;
    this.context = canv.getContext('2d');
    this.config = config;
    this.container = div; //container for the main time scale.

    //TODO check for window resizes to set these.
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;

    canv.setAttribute('width', this.width);
    canv.setAttribute('height', this.height);

    //array of divs displaying time every 30 seconds. (TODO should make this depend on resolution)
    this.times = [];

    this.prevScrollPos = 0; //checking the horizontal scroll (must update timeline above in case of change)

    //TODO check scroll adjust.
    function doneResizing() {
        that.width = that.container.clientWidth;
        that.height = that.container.clientHeight;

        canv.setAttribute('width', that.width);
        canv.setAttribute('height', that.height);

        that.drawScale();
    };

    function onResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(doneResizing, 100);
    };

    TimeScale.prototype.onResize = onResize;

    this.drawScale();
};

/*
    Return time in format mm:ss
*/
TimeScale.prototype.formatTime = function(seconds) {
    var out, m, s;

    s = seconds % 60;
    m = (seconds - s) / 60;

    if (s < 10) {
        s = "0"+s;
    }

    out = m + ":" + s;

    return out;
};

TimeScale.prototype.clear = function() {
   
    this.container.innerHTML = "";
    this.context.clearRect(0, 0, this.width, this.height);
};

TimeScale.prototype.drawScale = function(offset) {
    var cc = this.context,
        canv = this.canv,
        colors = this.config.getColorScheme(),
        pix,
        res = this.config.getResolution(),
        SR = this.config.getSampleRate(),
        pixPerSec = SR/res,
        pixOffset = offset || 0, //caused by scrolling horizontally
        i,
        end,
        counter = 0,
        pixIndex,
        container = this.container,
        width = this.width,
        height = this.height,
        div,
        time,
        sTime,
        fragment = document.createDocumentFragment(),
        scaleY,
        scaleHeight;


    this.clear();

    fragment.appendChild(canv);
    cc.fillStyle = colors.timeColor;
    end = width + pixOffset;

    for (i = 0; i < end; i = i + pixPerSec) {

        pixIndex = ~~(i);
        pix = pixIndex - pixOffset;

        if (pixIndex >= pixOffset) {

            //put a timestamp every 30 seconds.
            if (counter % 30 === 0) {

                sTime = this.formatTime(counter);
                time = document.createTextNode(sTime);
                div = document.createElement("div");
        
                div.style.left = pix+"px";
                div.appendChild(time);
                fragment.appendChild(div);

                scaleHeight = 10;
                scaleY = height - scaleHeight;
            }
            else if (counter % 5 === 0) {
                scaleHeight = 5;
                scaleY = height - scaleHeight;
            }
            else {
                scaleHeight = 2;
                scaleY = height - scaleHeight;
            }

            cc.fillRect(pix, scaleY, 1, scaleHeight);
        }

        counter++;  
    }

    container.appendChild(fragment);
};

TimeScale.prototype.onTrackScroll = function() {
    var scroll = this.config.getTrackScroll(),
        scrollX = scroll.left;    

    if (scrollX !== this.prevScrollPos) {
        this.prevScrollPos = scrollX;
        this.drawScale(scrollX);
    }
};

TimeScale.prototype.onResolutionChange = function() {
    var scroll = this.config.getTrackScroll(),
        scrollX = scroll.left;    

    this.drawScale(scrollX);
};


'use strict';

var AudioControls = function() {

};

AudioControls.prototype.groups = {
    "audio-select": ["btns_audio_tools"]
};

AudioControls.prototype.classes = {
    "btn-state-active": "btn btn-mini active",
    "btn-state-default": "btn btn-mini",
    "disabled": "disabled",
    "active": "active"
};

AudioControls.prototype.events = {
   "btn-rewind": {
        click: "rewindAudio"
    },

    "btn-fast-forward": {
        click: "fastForwardAudio"
    },

   "btn-play": {
        click: "playAudio"
    },

    "btn-pause": {
        click: "pauseAudio"
    },
 
    "btn-stop": {
        click: "stopAudio"
    },

    "btn-cursor": {
        click: "changeState"
    },

    "btn-select": {
        click: "changeState"
    },

    "btn-shift": {
        click: "changeState"
    },

    "btn-fadein": {
        click: "changeState"
    },

    "btn-fadeout": {
        click: "changeState"
    },

    "btn-save": {
        click: "save"
    },

    "btn-open": {
        click: "open"
    },
    
    "btn-trim-audio": {
        click: "trimAudio"
    },

    "time-format": {
        change: "changeTimeFormat"
    },

    "audio-pos": {

    },

    "audio-start": {
        blur: "validateCueIn"
    },

    "audio-end": {
        blur: "validateCueOut"
    },

    "btn-logarithmic": {
        click: "changeDefaultFade"
    },

    "btn-linear": {
        click: "changeDefaultFade"
    },

    "btn-exponential": {
        click: "changeDefaultFade"
    },

    "btn-sCurve": {
        click: "changeDefaultFade"
    },

    "btn-zoom-in": {
        click: "zoomIn"
    },

    "btn-zoom-out": {
        click: "zoomOut"
    }
};

AudioControls.prototype.validateCue = function(value) {
    var validators,
        regex,
        result;

    validators = {
        "seconds": /^\d+$/,

        "thousandths": /^\d+\.\d{3}$/,

        "hh:mm:ss": /^[0-9]{2,}:[0-5][0-9]:[0-5][0-9]$/,

        "hh:mm:ss.u": /^[0-9]{2,}:[0-5][0-9]:[0-5][0-9]\.\d{1}$/,

        "hh:mm:ss.uu": /^[0-9]{2,}:[0-5][0-9]:[0-5][0-9]\.\d{2}$/,

        "hh:mm:ss.uuu": /^[0-9]{2,}:[0-5][0-9]:[0-5][0-9]\.\d{3}$/
    };

    regex = validators[this.timeFormat];
    result = regex.test(value);

    return result;
};

AudioControls.prototype.cueToSeconds = function(value) {
    var converter,
        func,
        seconds;

    function clockConverter(value) {
        var data = value.split(":"),
            hours = parseInt(data[0], 10) * 3600,
            mins = parseInt(data[1], 10) * 60,
            secs = parseFloat(data[2]),
            seconds;

        seconds = hours + mins + secs;

        return seconds;
    }

    converter = {
        "seconds": function(value) {
            return parseInt(value, 10);
        },

        "thousandths": function(value) {
            return parseFloat(value);
        },

        "hh:mm:ss": function(value) {
            return clockConverter(value);
        },

        "hh:mm:ss.u": function(value) {
            return clockConverter(value);
        },

        "hh:mm:ss.uu": function(value) {
            return clockConverter(value);
        },

        "hh:mm:ss.uuu": function(value) {
            return clockConverter(value);
        } 
    };

    func = converter[this.timeFormat];
    seconds = func(value);

    return seconds;
};

AudioControls.prototype.cueFormatters = function(format) {

    function clockFormat(seconds, decimals) {
        var hours,
            minutes,
            secs,
            result;

        hours = parseInt(seconds / 3600, 10) % 24;
        minutes = parseInt(seconds / 60, 10) % 60;
        secs = seconds % 60;
        secs = secs.toFixed(decimals);

        result = (hours < 10 ? "0" + hours : hours) + ":" + (minutes < 10 ? "0" + minutes : minutes) + ":" + (secs < 10 ? "0" + secs : secs);

        return result;
    }

    var formats = {
        "seconds": function (seconds) {
            return seconds.toFixed(0);
        },

        "thousandths": function (seconds) {
            return seconds.toFixed(3);
        },

        "hh:mm:ss": function (seconds) {
            return clockFormat(seconds, 0);   
        },

        "hh:mm:ss.u": function (seconds) {
            return clockFormat(seconds, 1);   
        },

        "hh:mm:ss.uu": function (seconds) {
            return clockFormat(seconds, 2);   
        },

        "hh:mm:ss.uuu": function (seconds) {
            return clockFormat(seconds, 3);   
        }
    };

    return formats[format];
};

AudioControls.prototype.init = function(config) {
    var that = this,
        className,
        event,
        events = this.events,
        tmpEl,
        func,
        state,
        container,
        fadeType,
        tmpBtn;

    makePublisher(this);

    this.ctrls = {};
    this.config = config;
    container = this.config.getContainer();
    state = this.config.getState();
    fadeType = this.config.getFadeType();

    ["btn-"+state, "btn-"+fadeType].forEach(function(buttonClass) {
        tmpBtn = document.getElementsByClassName(buttonClass)[0];

        if (tmpBtn) {
            this.activateButton(tmpBtn);
        }
    }, this);  

    for (className in events) {
    
        tmpEl = container.getElementsByClassName(className)[0];
        this.ctrls[className] = tmpEl;

        for (event in events[className]) {

            if (tmpEl) {
                func = that[events[className][event]].bind(that);
                tmpEl.addEventListener(event, func);
            }
        }
    } 

    if (this.ctrls["time-format"]) {
        this.ctrls["time-format"].value = this.config.getTimeFormat();
    }


    this.timeFormat = this.config.getTimeFormat();

    //Kept in seconds so time format change can update fields easily.
    this.currentSelectionValues = undefined;

    this.onCursorSelection({
        start: 0,
        end: 0
    });
};

AudioControls.prototype.changeDefaultFade = function(e) {
    var el = e.currentTarget,
        prevEl = el.parentElement.getElementsByClassName('active')[0],
        type = el.dataset.fade;

    this.deactivateButton(prevEl);
    this.activateButton(el);

    this.config.setFadeType(type);
};

AudioControls.prototype.changeTimeFormat = function(e) {
    var format = e.target.value,
        func, start, end;

    format = (this.cueFormatters(format) !== undefined) ? format : "hh:mm:ss";
    this.config.setTimeFormat(format);
    this.timeFormat = format;

    if (this.currentSelectionValues !== undefined) {
        func = this.cueFormatters(format);
        start = this.currentSelectionValues.start;
        end = this.currentSelectionValues.end;

        if (this.ctrls["audio-start"]) {
            this.ctrls["audio-start"].value = func(start);
        }

        if (this.ctrls["audio-end"]) {
            this.ctrls["audio-end"].value = func(end);
        }
    }
};

AudioControls.prototype.zoomIn = function() {
    var newRes = this.config.getResolution() * (3/4),
        min = this.config.getMinResolution();

    newRes = (newRes < min) ? min : newRes;

    if (newRes > min) {
        this.zoom(newRes);
    }
};

AudioControls.prototype.zoomOut = function() {
    var newRes = this.config.getResolution() * (4/3),
        max = this.config.getMaxResolution();

    newRes = (newRes > max) ? max : newRes;

    if (newRes < max) {
        this.zoom(newRes);
    }
};

AudioControls.prototype.zoom = function(res) {
    this.config.setResolution(res);
    this.fire("changeresolution", res);
};

AudioControls.prototype.validateCueIn = function(e) {
    var value = e.target.value,
        end,
        startSecs;

    if (this.validateCue(value)) {
        end = this.currentSelectionValues.end;
        startSecs = this.cueToSeconds(value);

        if (startSecs <= end) {
            this.notifySelectionUpdate(startSecs, end);
            this.currentSelectionValues.start = startSecs;
            return;
        }
    }

    //time entered was otherwise invalid.
    e.target.value = this.cueFormatters(this.timeFormat)(this.currentSelectionValues.start);
};

AudioControls.prototype.validateCueOut = function(e) {
    var value = e.target.value,
        start,
        endSecs;

    if (this.validateCue(value)) {
        start = this.currentSelectionValues.start;
        endSecs = this.cueToSeconds(value);

        if (endSecs >= start) {
            this.notifySelectionUpdate(start, endSecs);
            this.currentSelectionValues.end = endSecs;
            return;
        }
    }

    //time entered was otherwise invalid.
    e.target.value = this.cueFormatters(this.timeFormat)(this.currentSelectionValues.end);
};

AudioControls.prototype.activateButtonGroup = function(id) {
    var el = document.getElementById(id),
        btns,
        classes = this.classes,
        i, len;

    if (el === null) {
        return;
    }

    btns = el.children;

    for (i = 0, len = btns.length; i < len; i++) {
        btns[i].classList.remove(classes["disabled"]);
    }
};

AudioControls.prototype.deactivateButtonGroup = function(id) {
    var el = document.getElementById(id),
        btns,
        classes = this.classes,
        i, len;

    if (el === null) {
        return;
    }

    btns = el.children;

    for (i = 0, len = btns.length; i < len; i++) {
        btns[i].classList.add(classes["disabled"]);
    }
};

AudioControls.prototype.activateAudioSelection = function() {
    var ids = this.groups["audio-select"],
        i, len;

    for (i = 0, len = ids.length; i < len; i++) {
        this.activateButtonGroup(ids[i]);
    }
};

AudioControls.prototype.deactivateAudioSelection = function() {
    var ids = this.groups["audio-select"],
        i, len;

    for (i = 0, len = ids.length; i < len; i++) {
        this.deactivateButtonGroup(ids[i]);
    }
};

AudioControls.prototype.save = function() {

    this.fire('playlistsave', this);
};

AudioControls.prototype.open = function() {

    this.fire('playlistrestore', this);
};

AudioControls.prototype.rewindAudio = function() {

    this.fire('rewindaudio', this);
};

AudioControls.prototype.fastForwardAudio = function() {

    this.fire('fastforwardaudio', this);
};

AudioControls.prototype.playAudio = function() {

    this.fire('playaudio', this);
};

AudioControls.prototype.pauseAudio = function() {

    this.fire('pauseaudio', this);
};

AudioControls.prototype.stopAudio = function() {

    this.fire('stopaudio', this);
};

AudioControls.prototype.activateButton = function(el) {
    if (el) {
        el.classList.add(this.classes["active"]);
    }
};

AudioControls.prototype.deactivateButton = function(el) {
    if (el) {
        el.classList.remove(this.classes["active"]);
    }
};

AudioControls.prototype.enableButton = function(el) {
    if (el) {
        el.classList.remove(this.classes["disabled"]);
    }
};

AudioControls.prototype.disableButton = function(el) {
    if (el) {
        el.classList.add(this.classes["disabled"]);
    }
};

AudioControls.prototype.changeState = function(e) {
    var el = e.currentTarget,
        prevEl = el.parentElement.getElementsByClassName('active')[0],
        state = el.dataset.state;

    this.deactivateButton(prevEl);
    this.activateButton(el);

    this.config.setState(state);
    this.fire('changestate', this);
};

AudioControls.prototype.trimAudio = function(e) {
    var el = e.target,
        disabled,
        classes = this.classes;

    disabled = el.classList.contains(classes["disabled"]);

    if (!disabled) {
        this.fire('trackedit', {
            type: "trimAudio"
        });
    }  
};

AudioControls.prototype.createFade = function(e) {
    var el = e.target,
        shape = el.dataset.shape,
        type = el.dataset.type,
        disabled,
        classes = this.classes;

    disabled = el.classList.contains(classes["disabled"]);

    if (!disabled) {
        this.fire('trackedit', {
            type: "createFade",
            args: {
                type: type, 
                shape: shape
            }
        });
    }  
};

AudioControls.prototype.onAudioSelection = function() {
    this.activateAudioSelection();
};

AudioControls.prototype.onAudioDeselection = function() {
    this.deactivateAudioSelection();
};

/*
    start, end in seconds
*/
AudioControls.prototype.notifySelectionUpdate = function(start, end) {
    
    this.fire('changeselection', {
        start: start,
        end: end
    });
}; 

/*
    start, end in seconds
*/
AudioControls.prototype.onCursorSelection = function(args) {
    var startFormat = this.cueFormatters(this.timeFormat)(args.start),
        endFormat = this.cueFormatters(this.timeFormat)(args.end),
        start = this.cueToSeconds(startFormat),
        end = this.cueToSeconds(endFormat);

    this.currentSelectionValues = {
        start: start,
        end:end
    };

    if (this.ctrls["audio-start"]) {
        this.ctrls["audio-start"].value = startFormat;
    }

    if (this.ctrls["audio-end"]) {
        this.ctrls["audio-end"].value = endFormat;
    }
};

/*
    args {seconds, pixels}
*/
AudioControls.prototype.onAudioUpdate = function(args) {
    if (this.ctrls["audio-pos"]) {
        this.ctrls["audio-pos"].innerHTML = this.cueFormatters(this.timeFormat)(args.seconds);
    } 
};


'use strict';

var PlaylistEditor = function() {

};

PlaylistEditor.prototype.setConfig = function(config) {
    this.config = config;
};

PlaylistEditor.prototype.init = function(tracks) {
    var that = this,
        i,
        len,
        container = this.config.getContainer(),
        div = container.getElementsByClassName("playlist-tracks")[0],
        fragment = document.createDocumentFragment(),
        trackEditor,
        trackElem,
        timeScale,
        audioControls;

    makePublisher(this);

    this.storage = new Storage();

    this.trackContainer = div;
    this.trackEditors = [];

    audioControls = new AudioControls();
    audioControls.init(this.config);

    if (this.config.isTimeScaleEnabled()) {
        timeScale = new TimeScale();
        timeScale.init(this.config);
        audioControls.on("changeresolution", "onResolutionChange", timeScale);
        this.on("trackscroll", "onTrackScroll", timeScale);
    }

    this.timeScale = timeScale;
    
    for (i = 0, len = tracks.length; i < len; i++) {

        trackEditor = new TrackEditor();
        trackEditor.setConfig(this.config);
        trackElem = trackEditor.loadTrack(tracks[i]);
    
        this.trackEditors.push(trackEditor);
        fragment.appendChild(trackElem);

        audioControls.on("trackedit", "onTrackEdit", trackEditor);
        audioControls.on("changeresolution", "onResolutionChange", trackEditor);

        trackEditor.on("activateSelection", "onAudioSelection", audioControls);
        trackEditor.on("deactivateSelection", "onAudioDeselection", audioControls);
        trackEditor.on("changecursor", "onCursorSelection", audioControls);
        trackEditor.on("changecursor", "onSelectUpdate", this);

        trackEditor.on("unregister", (function() {
            var editor = this;

            audioControls.remove("trackedit", "onTrackEdit", editor);
            audioControls.remove("changeresolution", "onResolutionChange", editor);

            that.removeTrack(editor);

        }).bind(trackEditor));
    }

    this.trackContainer.innerHTML = '';
    this.trackContainer.appendChild(fragment);
    this.trackContainer.onscroll = this.onTrackScroll.bind(this);

    this.sampleRate = this.config.getSampleRate();
   
    this.scrollTimeout = false;

    //for requestAnimationFrame that's toggled during play/stop.
    this.animationRequest;
    this.animationCallback = this.updateEditor.bind(this);

    this.on("playbackcursor", "onAudioUpdate", audioControls);

    audioControls.on("playlistsave", "save", this);
    audioControls.on("playlistrestore", "restore", this);
    audioControls.on("rewindaudio", "rewind", this);
    audioControls.on("fastforwardaudio", "fastForward", this);
    audioControls.on("playaudio", "play", this);
    audioControls.on("pauseaudio", "pause", this);
    audioControls.on("stopaudio", "stop", this);
    audioControls.on("trimaudio", "onTrimAudio", this);
    audioControls.on("changestate", "onStateChange", this);
    audioControls.on("changeselection", "onSelectionChange", this); 
};

PlaylistEditor.prototype.removeTrack = function(trackEditor) {
    var i, 
        len, 
        editor,
        editors = this.trackEditors;
    
    for (i = 0, len = editors.length; i < len; i++) {
        editor = editors[i];

        if (editor === trackEditor) {
            editors.splice(i, 1);
            return;
        }
    }
};

PlaylistEditor.prototype.resize = function() {
    this.timeScale.onResize();
};

PlaylistEditor.prototype.onTrimAudio = function() {
    var track = this.activeTrack,
        selected = track.getSelectedArea(),
        start, end;

    if (selected === undefined) {
        return;
    }

    track.trim(selected.start, selected.end); 
};

/*
    Called when a user manually updates the cue points in the UI.
    args start/end are in seconds
*/
PlaylistEditor.prototype.onSelectionChange = function(args) {
    
    if (this.activeTrack === undefined) {
        return;
    }

    //TODO this should really be playlist wide - NOT track specific.
    var res = this.config.getResolution(),
        track = this.activeTrack,
        start = ~~(track.secondsToPixels(args.start) - track.samplesToPixels(track.leftOffset)),
        end = ~~(track.secondsToPixels(args.end) - track.samplesToPixels(track.leftOffset));

    this.config.setCursorPos(args.start);
    track.setSelectedArea(start, end);
};

PlaylistEditor.prototype.onStateChange = function() {
     var that = this,
        editors = this.trackEditors,
        i,
        len,
        editor,
        state = this.config.getState();

    for(i = 0, len = editors.length; i < len; i++) {
        editors[i].deactivate();
        editors[i].setState(state);
    }
};

PlaylistEditor.prototype.onTrackScroll = function() {
    var that = this;

    if (that.scrollTimeout) return;

    //limit the scroll firing to every 25ms.
    that.scrollTimeout = setTimeout(function() {
        
        that.config.setTrackScroll(that.trackContainer.scrollLeft, that.trackContainer.scrollTop);
        that.fire('trackscroll');
        that.scrollTimeout = false;
    }, 25);   
};

PlaylistEditor.prototype.activateTrack = function(trackEditor) {
    var that = this,
        editors = this.trackEditors,
        i,
        len,
        editor;

    for (i = 0, len = editors.length; i < len; i++) {
        editor = editors[i];

        if (editor === trackEditor) {
            editor.activate();
            this.activeTrack = trackEditor;
        }
        else {
            editor.deactivate();
        }
    }
};

PlaylistEditor.prototype.onSelectUpdate = function(event) {
    
    this.activateTrack(event.editor);
};

PlaylistEditor.prototype.resetCursor = function() {
    this.config.setCursorPos(0);
};

PlaylistEditor.prototype.onCursorSelection = function(args) {
    this.activateTrack(args.editor);
};

PlaylistEditor.prototype.rewind = function() {
    
    if (this.activeTrack !== undefined) {
        this.activeTrack.resetCursor();
    }
    else {
        this.resetCursor();
    } 

    this.stop();

    this.trackContainer.scrollLeft = 0;
    this.config.setTrackScroll(0);
    this.fire('trackscroll');
};

PlaylistEditor.prototype.fastForward = function() {
    var totalWidth = this.trackContainer.scrollWidth,
        clientWidth = this.trackContainer.offsetWidth,
        maxOffset = Math.max(totalWidth - clientWidth, 0);

    if (this.activeTrack !== undefined) {
        this.activeTrack.resetCursor();
    }

    this.stop();

    this.trackContainer.scrollLeft = maxOffset;
    this.config.setTrackScroll(maxOffset);
    this.fire('trackscroll');
};

/*
    returns selected time in global (playlist relative) seconds.
*/
PlaylistEditor.prototype.getSelected = function() {
    var selected,
        start,
        end;

    if (this.activeTrack) {
        selected = this.activeTrack.selectedArea;
        if (selected !== undefined && (selected.end > selected.start)) {
            return this.activeTrack.getSelectedPlayTime();
        }
    }
};

PlaylistEditor.prototype.isPlaying = function() {
     var editors = this.trackEditors,
        i,
        len,
        isPlaying = false;

    for (i = 0, len = editors.length; i < len; i++) {
        isPlaying = isPlaying || editors[i].isPlaying();
    }

    return isPlaying;
};

PlaylistEditor.prototype.play = function() {
    var that = this,
        editors = this.trackEditors,
        i,
        len,
        currentTime = this.config.getCurrentTime(),
        startTime = this.config.getCursorPos(),
        endTime,
        selected = this.getSelected();

    if (selected !== undefined) {
        startTime = selected.startTime;
        endTime = selected.endTime;
    }

    if (this.pausedAt) {
        startTime = this.pausedAt;
    }

    for (i = 0, len = editors.length; i < len; i++) {
        editors[i].schedulePlay(currentTime, startTime, endTime);
    }

    this.lastPlay = currentTime;
    this.animationRequest = window.requestAnimationFrame(this.animationCallback);
};

PlaylistEditor.prototype.pause = function() {
    var editors = this.trackEditors,
        i,
        len,
        currentTime = this.config.getCurrentTime(),
        startTime = this.config.getCursorPos();

    if (this.pausedAt) {
        startTime = this.pausedAt;
    }

    this.pausedAt = currentTime - this.lastPlay + startTime;

    window.cancelAnimationFrame(this.animationRequest);

    for (i = 0, len = editors.length; i < len; i++) {
        editors[i].scheduleStop(currentTime);
    }
};

PlaylistEditor.prototype.stop = function() {
     var editors = this.trackEditors,
        i,
        len,
        currentTime = this.config.getCurrentTime();

    this.pausedAt = undefined;

    window.cancelAnimationFrame(this.animationRequest);

    for (i = 0, len = editors.length; i < len; i++) {
        editors[i].scheduleStop(currentTime);
        editors[i].showProgress(0);
    }
};

PlaylistEditor.prototype.updateEditor = function() {
    var editors = this.trackEditors,
        i,
        len,
        currentTime = this.config.getCurrentTime(),
        elapsed = currentTime - this.lastPlay,
        res = this.config.getResolution(),
        cursorPos = this.config.getCursorPos(),
        cursorPixel,
        playbackSec;

    //update drawer to start drawing from where last paused.
    if (this.pausedAt) {
        cursorPos = this.pausedAt;
    }

    if (this.isPlaying()) {

        //if there's a change for the UI show progress.
        if (elapsed) {
            playbackSec = cursorPos + elapsed;
            cursorPixel = Math.ceil(playbackSec * this.sampleRate / res);
            
            for (i = 0, len = editors.length; i < len; i++) {
                editors[i].showProgress(cursorPixel);
            }

            this.fire("playbackcursor", {
                "seconds": playbackSec,
                "pixels": cursorPixel
            });
        }
        this.animationRequest = window.requestAnimationFrame(this.animationCallback);
    }
    else {
        //reset view to not playing look
        for (i = 0, len = editors.length; i < len; i++) {
            editors[i].showProgress(0);
        }
        window.cancelAnimationFrame(this.animationRequest);
    } 
};

PlaylistEditor.prototype.getJson = function() {
    var editors = this.trackEditors,
        i,
        len,
        info = [],
        json;

    for (i = 0, len = editors.length; i < len; i++) {
        info.push(editors[i].getTrackDetails());
    }

    json = JSON.stringify(info);

    return info;
};

PlaylistEditor.prototype.save = function() {
     var editors = this.trackEditors,
        i,
        len,
        info = [];

    for (i = 0, len = editors.length; i < len; i++) {
        info.push(editors[i].getTrackDetails());
    }

    this.storage.save("test", info);
};

PlaylistEditor.prototype.restore = function() {
    var state;

    state = this.storage.restore("test");

    this.trackContainer.innerHTML='';
    this.init(state);
};

