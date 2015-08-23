'use strict';

WaveformPlaylist.TimeScale = {

    init: function() {
        var that = this,
            canv,
            div,
            resizeTimer,
            controlSettings = this.config.getControlSettings();

        this.timeinfo = {
            20000: {
                marker: 30000,
                bigStep: 10000,
                smallStep: 5000,
                secondStep: 5
            },
            12000: {
                marker: 15000,
                bigStep: 5000,
                smallStep: 1000,
                secondStep: 1
            },
            10000: {
                marker: 10000,
                bigStep: 5000,
                smallStep: 1000,
                secondStep: 1
            },
            5000: {
                marker: 5000,
                bigStep: 1000,
                smallStep: 500,
                secondStep: 1/2
            },
            2500: {
                marker: 2000,
                bigStep: 1000,
                smallStep: 500,
                secondStep: 1/2
            },
            1500: {
                marker: 2000,
                bigStep: 1000,
                smallStep: 200,
                secondStep: 1/5
            },
            700: {
                marker: 1000,
                bigStep: 500,
                smallStep: 100,
                secondStep: 1/10
            }
        };

        WaveformPlaylist.makePublisher(this);

        div = document.querySelector(".playlist-time-scale");
        div.style.position = "relative";
        div.style.left = 0;
        div.style.right = 0;

        if (controlSettings.show) {
            div.style.marginLeft = controlSettings.width+"px";
        }

        if (div === undefined) {
            return;
        }
        
        canv = document.createElement("canvas");
        this.canv = canv;
        this.context = canv.getContext('2d');
        this.container = div; //container for the main time scale.

        //TODO check for window resizes to set these.
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;

        canv.setAttribute('width', this.width);
        canv.setAttribute('height', this.height);
        canv.style.position = "absolute";
        canv.style.left = 0;
        canv.style.right = 0;
        canv.style.top = 0;
        canv.style.bottom = 0;

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

        this.onResize = onResize;

        this.drawScale();
    },

    getScaleInfo: function(resolution) {
        var keys, i, end;

        keys = Object.keys(this.timeinfo).map(function(item) {
            return parseInt(item, 10);
        });

        //make sure keys are numerically sorted.
        keys = keys.sort(function(a, b){return a - b});

        for (i = 0, end = keys.length; i < end; i++) {
           if (resolution <= keys[i]) {
                return this.timeinfo[keys[i]];
            } 
        }
    },

    /*
        Return time in format mm:ss
    */
    formatTime: function(milliseconds) {
        var out, m, s, seconds;

        seconds = milliseconds/1000;

        s = seconds % 60;
        m = (seconds - s) / 60;

        if (s < 10) {
            s = "0"+s;
        }

        out = m + ":" + s;

        return out;
    },

    clear: function() {
       
        this.container.innerHTML = "";
        this.context.clearRect(0, 0, this.width, this.height);
    },

    drawScale: function(offset) {
        var cc = this.context,
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
            div,
            time,
            sTime,
            fragment = document.createDocumentFragment(),
            scaleY,
            scaleHeight,
            scaleInfo = this.getScaleInfo(res);

        this.clear();

        fragment.appendChild(this.canv);
        cc.fillStyle = colors.timeColor;
        end = this.width + pixOffset;

        for (i = 0; i < end; i = i + pixPerSec*scaleInfo.secondStep) {

            pixIndex = ~~(i);
            pix = pixIndex - pixOffset;

            if (pixIndex >= pixOffset) {

                //put a timestamp every 30 seconds.
                if (scaleInfo.marker && (counter % scaleInfo.marker === 0)) {

                    sTime = this.formatTime(counter);
                    time = document.createTextNode(sTime);
                    div = document.createElement("div");
            
                    div.style.position = "absolute";
                    div.style.left = pix+"px";
                    div.appendChild(time);
                    fragment.appendChild(div);

                    scaleHeight = 10;
                }
                else if (scaleInfo.bigStep && (counter % scaleInfo.bigStep === 0)) {
                    scaleHeight = 5;
                }
                else if (scaleInfo.smallStep && (counter % scaleInfo.smallStep === 0)) {
                    scaleHeight = 2;
                }

                scaleY = this.height - scaleHeight;
                cc.fillRect(pix, scaleY, 1, scaleHeight);
            }

            counter += 1000*scaleInfo.secondStep;  
        }

        this.container.appendChild(fragment);
    },

    onTrackScroll: function(scrollX, scrollY) {
        if (scrollX !== this.prevScrollPos) {
            this.prevScrollPos = scrollX;
            this.drawScale(scrollX);
        }
    },

    onResolutionChange: function() {
        var scroll = this.config.getTrackScroll(),
            scrollX = scroll.left;    

        this.drawScale(scrollX);
    }
};
