'use strict';

WaveformPlaylist.WaveformDrawer = {

    MAX_CANVAS_WIDTH: 20000,

    init: function() {

        WaveformPlaylist.makePublisher(this);

        this.container = document.createElement("div");
        this.container.classList.add("channel-wrapper");

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

        return this.container;
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

    drawError: function() {
        this.container.innerHTML = "";
        this.container.classList.add("error");
    },

    drawActive: function() {
        this.container.classList.add("active");
    },

    drawInactive: function() {
        this.container.classList.remove("active");
        this.selection && this.waveformContainer.removeChild(this.selection);
        this.selection = undefined;
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
        Returns a pixel clicked on this track relative to the entire playlist.
    */
    findClickedPixel: function(e) {
        var target = e.target,
            layerOffset = 0,
            canvasOffset = 0,
            parent,
            startX = e.layerX || e.offsetX;

        //need to find the canvas offset
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
            else {
                canvasOffset = target.dataset.offset;
            }

        }
        else {
            //selection div may even throw us off.
            if (target.classList.contains('selection')) {
                layerOffset += target.offsetLeft;
            }
        }

        return layerOffset + startX + (canvasOffset * this.MAX_CANVAS_WIDTH);
    },

    drawBuffer: function(buffer, cues) {
        var canv,
            div,
            progress,
            cursor,
            i,
            top = 0,
            left = 0,
            makeMono = this.config.isDisplayMono(),
            res = this.config.getResolution(),
            numChan = makeMono? 1 : buffer.numberOfChannels,
            numSamples = cues.cueout - cues.cuein + 1,
            fragment = document.createDocumentFragment(),
            wrapperHeight,
            canvases,
            width,
            tmpWidth,
            canvasOffset,
            controls,
            volumeInput,
            waveformContainer; 

        this.container.innerHTML = "";
        this.channels = []; 
        this.selection = undefined; 

        //width and height is per waveform canvas.
        this.width = Math.ceil(numSamples / res);
        this.height = this.config.getWaveHeight();
        wrapperHeight = numChan * this.height;


        controls = document.createElement("div");
        controls.style.height = wrapperHeight+"px";
        controls.style.width = "150px";
        controls.style.position = "absolute";
        controls.style.left = 0;
        controls.classList.add("controls");
        controls.style.zIndex = 1000;

        volumeInput = document.createElement("input");
        volumeInput.type = "range";
        volumeInput.setAttribute('min', 0);
        volumeInput.setAttribute('max', 100);
        volumeInput.classList.add("volume-slider");

        waveformContainer = document.createElement("div");
        waveformContainer.classList.add("waveform");
        waveformContainer.style.height = wrapperHeight+"px";
        waveformContainer.style.width = this.width+"px";
        waveformContainer.style.position = "relative";

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

        this.controlContainer = controls;
        this.waveformContainer = waveformContainer;
        this.cursor = cursor;

        controls.appendChild(volumeInput);
        waveformContainer.appendChild(cursor);
        fragment.appendChild(controls);
        fragment.appendChild(waveformContainer);

        //create elements for each audio channel
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
            div.appendChild(progress);


            width = 0;
            canvases = [];
            canvasOffset = 0;

            //might need to draw the track over multiple canvases as per memory limits.
            while (width < this.width) {
                tmpWidth = Math.min(this.MAX_CANVAS_WIDTH, this.width - width);
                //canvas with the waveform drawn
                canv = document.createElement("canvas");
                canv.setAttribute('width', tmpWidth);
                canv.setAttribute('height', this.height);
                canv.style.cssFloat = "left";
                canv.style.position = "relative";
                canv.style.margin = 0;
                canv.style.padding = 0;
                canv.style.zIndex = 3;
                canv.dataset.offset = canvasOffset;
                div.appendChild(canv);

                canvases.push(canv);
                width += tmpWidth;
                canvasOffset++;
            }

            this.channels.push({
                canvas: canvases,
                div: div,
                progress: progress
            });

            waveformContainer.appendChild(div);
            top = top + this.height;
        }

        this.getPeaks(buffer, cues);
        this.draw();
        this.drawTimeShift();

        this.container.style.height = wrapperHeight+"px";
        this.container.appendChild(fragment);
    },

    drawFrame: function(chanNum, index, peak) {
        var x, max, min,
            h2 = this.height / 2,
            canvOffset = Math.floor(index/this.MAX_CANVAS_WIDTH),
            cc = this.channels[chanNum].canvas[canvOffset].getContext('2d'),
            colors = this.config.getColorScheme();

        max = Math.abs(peak.max * h2);
        min = Math.abs(peak.min * h2);

        x = index - canvOffset*this.MAX_CANVAS_WIDTH;
        cc.fillStyle = colors.waveOutlineColor;

        //draw maxs
        cc.fillRect(x, 0, 1, h2-max);
        //draw mins
        cc.fillRect(x, h2+min, 1, h2-min);
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
            this.waveformContainer.appendChild(selection);
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
