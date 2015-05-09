'use strict';

WaveformPlaylist.WaveformDrawer = {

    init: function() {

        WaveformPlaylist.makePublisher(this);

        this.channels = []; //array of canvases, contexts, 1 for each channel displayed.
        this.pixelOffset = 0;
        this.containerWidth = 0;

        var theme = this.config.getUITheme();

        if (this.loaderStates[theme] !== undefined) {
            this.loaderStates = this.loaderStates[theme];
        }
        else {
            this.loaderStates = this.loaderStates["default"];
        }
    },

    loaderStates: {
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
    },

    getPeaks: function(buffer, cues) {
        
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
    },

    setPixelOffset: function(pixels) {
        var containerWidth = pixels + this.width;

        this.pixelOffset = pixels;
        this.drawTimeShift();

        //minimum width in pixels required by this waveform
        this.containerWidth = pixels + this.width;
    },

    drawTimeShift: function() {
        var i, len;

        for (i = 0, len = this.channels.length; i < len; i++) {
            this.channels[i].div.style.left = this.pixelOffset+"px";
        } 
    },

    updateLoader: function(percent) {
        this.loader.style.width = percent+"%";
    },

    setLoaderState: function(state) {
        this.loader.className = this.loaderStates[state];
    },

    drawLoading: function() {
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
    },

    /*
        Returns a layerOffset in pixels relative to the entire playlist.
    */
    findLayerOffset: function(target) {
        var layerOffset = 0,
            parent;

        if (target.tagName === "CANVAS") {
            //If canvas selected must add left offset to layerX
            //this will be an offset relative to the entire playlist.
            parent = target.parentNode;
            layerOffset = parent.offsetLeft;

            //need to add the offset of the channel wrapper as well.
            if (parent.classList.contains('playlist-fade')) {
                parent = parent.parentNode;
                layerOffset += parent.offsetLeft;
            }

        }
        else {
            //selection div may even throw us off.
            if (target.classList.contains('selection')) {
                layerOffset += target.offsetLeft;
            }
        }

        return layerOffset;
    },

    drawBuffer: function(buffer, cues) {
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
            wrapperHeight; 

        this.container.innerHTML = "";
        this.channels = []; 
        this.selection = undefined; 

        //width and height is per waveform canvas.
        this.width = Math.ceil(numSamples / res);
        this.height = this.config.getWaveHeight();

        for (i = 0; i < numChan; i++) {

            //main container for this channel
            div = document.createElement("div");
            div.classList.add("channel");
            div.classList.add("channel-"+i);
            div.style.width = this.width+"px";
            div.style.height = this.height+"px";
            div.style.top = top+"px";
            div.style.left = left+"px";
            div.style.position = "absolute";
            div.style.margin = 0;
            div.style.padding = 0;
            div.style.zIndex = 1;

            //shows playback progress
            progress = document.createElement("div");
            progress.classList.add("channel-progress");
            progress.style.position = "absolute";
            progress.style.width = 0;
            progress.style.height = this.height+"px";
            progress.style.zIndex = 2;

            //canvas with the waveform drawn
            canv = document.createElement("canvas");
            canv.setAttribute('width', this.width);
            canv.setAttribute('height', this.height);
            canv.style.position = "absolute";
            canv.style.margin = 0;
            canv.style.padding = 0;
            canv.style.zIndex = 3;

            //will be used later for evelopes now.
            surface = document.createElement("canvas");
            surface.setAttribute('width', this.width);
            surface.setAttribute('height', this.height);
            surface.style.position = "absolute";
            surface.style.margin = 0;
            surface.style.padding = 0;
            surface.style.zIndex = 4;

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
        cursor.style.boxSizing = "content-box";
        cursor.style.margin = 0;
        cursor.style.padding = 0;
        cursor.style.top = 0;
        cursor.style.left = 0;
        cursor.style.bottom = 0;
        cursor.style.zIndex = 100;

        this.cursor = cursor;

        fragment.appendChild(cursor);
      
        wrapperHeight = numChan * this.height;
        this.container.style.height = wrapperHeight+"px";
        this.container.appendChild(fragment);
        
        this.getPeaks(buffer, cues);
        this.draw();
        this.drawTimeShift();
    },

    drawFrame: function(chanNum, index, peak) {
        var x, y, w, h, max, min,
            h2 = this.height / 2,
            cc = this.channels[chanNum].context,
            colors = this.config.getColorScheme();

        max = Math.abs(peak.max * h2);
        min = Math.abs(peak.min * h2);

        w = 1;
        x = index * w;
        
        cc.fillStyle = colors.waveOutlineColor;

        //draw maxs
        cc.fillRect(x, 0, w, h2-max);
        //draw mins
        cc.fillRect(x, h2+min, w, h2-min);
    },

    /*
        start, end are optional parameters to only redraw part of the canvas.
    */
    draw: function(start, end) {
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
    },

    /*
        Clear the surface canvas where envelopes etc will be drawn.
    */
    clear: function() {
        var i, len;

        for (i = 0, len = this.channels.length; i < len; i++) {
            this.channels[i].surface.clearRect(0, 0, this.width, this.height);
        }
    },

    /*
        set width of progress box according to cursor position (in pixels).
    */
    updateProgress: function(cursorPos) {
        this.drawProgress(cursorPos);
        this.drawCursor(cursorPos);
    },

    drawProgress: function(cursorPos) {
        var i, len,
            currentWidth = Math.max(cursorPos - this.pixelOffset, 0),
            width = Math.min(currentWidth, this.width);

        for (i = 0, len = this.channels.length; i < len; i++) {
            this.channels[i].progress.style.width = width+"px";
        }
    },

    drawCursor: function(cursorPos) {
        this.cursor.style.width = cursorPos+"px";
    },

    /*
        start, end in pixels.
    */
    drawHighlight: function(start, end) {
        var width = end - start + 1,
            selectionClass,
            selection = this.selection || document.createElement("div");

        selectionClass = (width === 1) ? 'selection-cursor' : 'selection-segment';

        selection.className = "";
        selection.classList.add(selectionClass);
        selection.classList.add("selection");
        selection.style.position = "absolute";
        selection.style.width = width+"px";
        selection.style.bottom = 0;
        selection.style.top = 0;
        selection.style.left = start+"px";
        selection.style.zIndex = 2000;

        if (this.selection === undefined) {
            this.container.appendChild(selection);
            this.selection = selection;
        }
    },

    sCurveFadeIn: function sCurveFadeIn(width) {
        return this.createSCurveBuffer(width, (Math.PI/2));
    },

    sCurveFadeOut: function sCurveFadeOut(width) {
        return this.createSCurveBuffer(width, -(Math.PI/2));  
    },

    logarithmicFadeIn: function logarithmicFadeIn(width) {
        return this.createLogarithmicBuffer(width, 10, 1);
    },

    logarithmicFadeOut: function logarithmicFadeOut(width) {
        return this.createLogarithmicBuffer(width, 10, -1);  
    },

    exponentialFadeIn: function exponentialFadeIn(width) {
        return this.createExponentialBuffer(width, 1);
    },

    exponentialFadeOut: function exponentialFadeOut(width) {
        return this.createExponentialBuffer(width, -1);  
    },

    linearFadeIn: function linearFadeIn(width) {
        return this.createLinearBuffer(width, 1);
    },

    linearFadeOut: function linearFadeOut(width) {
        return this.createLinearBuffer(width, -1);  
    },

    drawFadeCurve: function(ctx, shape, type, width) {
        var method = shape+type,
            fn = this[method],
            colors = this.config.getColorScheme(),
            curve,
            i, len,
            cHeight = this.height,
            y;

        ctx.strokeStyle = colors.fadeColor;

        curve = fn.call(this, width);

        y = cHeight - curve[0] * cHeight;
        ctx.beginPath();
        ctx.moveTo(0, y);

        for (i = 1, len = curve.length; i < len; i++) {
            y = cHeight - curve[i] * cHeight;
            ctx.lineTo(i, y);
        }
        ctx.stroke();
    },

    removeFade: function(id) {
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
    },

    drawFade: function(id, type, shape, start, end) {
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
        div.style.position = "absolute";
        div.style.width = width+"px";
        div.style.height = this.height+"px";
        div.style.top = 0;
        div.style.left = left+"px";
        div.style.zIndex = 1000;

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
    },

    drawFades: function(fades) {
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
    }
};

WaveformPlaylist.mixin(WaveformPlaylist.WaveformDrawer, WaveformPlaylist.curves);
