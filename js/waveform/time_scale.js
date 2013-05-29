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

