'use strict';

var WaveformDrawer = function() {

};

WaveformDrawer.prototype.init = function(container, config) {

    makePublisher(this);

    this.config = config;
    this.container = container;
    this.channels = []; //array of canvases, contexts, 1 for each channel displayed.

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
        "downloading": "progress progress-warning",
        "decoding": "progress progress-success progress-striped active",
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

WaveformDrawer.prototype.setTimeShift = function(pixels) {
    var i, len;

    for (i = 0, len = this.channels.length; i < len; i++) {
        this.channels[i].div.style.left = pixels+"px";
    } 
};

WaveformDrawer.prototype.updateLoader = function(percent) {
    this.loader.style.width = percent+"%";
};

WaveformDrawer.prototype.setLoaderState = function(state) {
    this.progressDiv.className = this.loaderStates[state];
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

    this.progressDiv = div;
    this.loader = loader;

    this.setLoaderState("downloading");
    this.updateLoader(0);

    this.container.appendChild(div);
};

WaveformDrawer.prototype.drawBuffer = function(buffer, pixelOffset, cues) {
    var canv,
        div,
        i,
        top = 0,
        left = 0,
        makeMono = this.config.isDisplayMono(),
        res = this.config.getResolution(),
        numChan = makeMono? 1 : buffer.numberOfChannels,
        numSamples = cues.cueout - cues.cuein + 1,
        fragment = document.createDocumentFragment(),
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

        canv = document.createElement("canvas");
        canv.setAttribute('width', this.width);
        canv.setAttribute('height', this.height);

        this.channels.push({
            canvas: canv,
            context: canv.getContext('2d'),
            div: div
        });

        div.appendChild(canv);
        fragment.appendChild(div);

        top = top + this.height;
    }
  
    wrapperHeight = numChan * this.height;
    this.container.style.height = wrapperHeight+"px";
    this.container.appendChild(fragment);
    

    this.getPeaks(buffer, cues);
    this.updateEditor();

    this.setTimeShift(pixelOffset);
};

WaveformDrawer.prototype.drawFrame = function(chanNum, index, peaks, maxPeak, cursorPos, pixelOffset) {
    var x, y, w, h, max, min,
        h2 = this.height / 2,
        cc = this.channels[chanNum].context,
        colors = this.config.getColorScheme();

    max = (peaks.max / maxPeak) * h2;
    min = (peaks.min / maxPeak) * h2;

    w = 1;
    x = index * w;
    y = Math.round(h2 - max);
    h = Math.ceil(max - min);

    //to prevent blank space when there is basically silence in the track.
    h = h === 0 ? 1 : h; 

    if (cursorPos >= (x + pixelOffset)) {
        cc.fillStyle = colors.progressColor;
    } 
    else {
        cc.fillStyle = colors.waveColor;
    }

    cc.fillRect(x, y, w, h);
};

/*
    start, end are optional parameters to only redraw part of the canvas.
*/
WaveformDrawer.prototype.draw = function(cursorPos, pixelOffset, start, end) {
    var that = this,
        peaks = this.peaks,
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

    this.clear(i, len);
 
    for (; i < len; i++) {

        peaks[i].forEach(function(peak, chanNum) {
            that.drawFrame(chanNum, i, peak, that.maxPeak, cursorPos, pixelOffset);
        });
    } 
};

/*
    If start/end are set clear only part of the canvas.
*/
WaveformDrawer.prototype.clear = function(start, end) {
    var i, len,
        width = end - start;

    for (i = 0, len = this.channels.length; i < len; i++) {
        this.channels[i].context.clearRect(start, 0, width, this.height);
    }
};

WaveformDrawer.prototype.updateEditor = function(cursorPos, pixelOffset, start, end, highlighted, selected) {
    var i, len,
        fragment = document.createDocumentFragment();

    this.container.innerHTML = "";

    this.draw(cursorPos, pixelOffset, start, end);

    if (highlighted === true && selected !== undefined) {
        var border = (selected.end - selected.start === 0) ? true : false;
        this.drawHighlight(selected.start, selected.end, border);
    }

    for (i = 0, len = this.channels.length; i < len; i++) {  
        fragment.appendChild(this.channels[i].div);
    }

    this.container.appendChild(fragment);
};

/*
    start, end in pixels.
*/
WaveformDrawer.prototype.drawHighlight = function(start, end, isBorder) {
    var i, len,
        colors = this.config.getColorScheme(),
        fillStyle,
        ctx,
        width = end - start + 1;

    fillStyle = (isBorder) ? colors.selectBorderColor : colors.selectBackgroundColor;

    for (i = 0, len = this.channels.length; i < len; i++) {
        ctx = this.channels[i].context;
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

