'use strict';

var AudioControls = function() {

};

AudioControls.prototype.groups = {
    "audio-select": ["btns_audio_tools", "btns_fade"]
};

AudioControls.prototype.classes = {
    "btn-state-active": "btn btn-mini active",
    "btn-state-default": "btn btn-mini",
    "disabled": "disabled",
    "active": "active"
};

AudioControls.prototype.events = {
   "btn_rewind": {
        click: "rewindAudio"
    },

   "btn_play": {
        click: "playAudio"
    },
 
    "btn_stop": {
        click: "stopAudio"
    },

    "btn_cursor": {
        click: "changeState"
    },

    "btn_select": {
        click: "changeState"
    },

    "btn_shift": {
        click: "changeState"
    },

    "btn_fadein": {
        click: "changeState"
    },

    "btn_fadeout": {
        click: "changeState"
    },


    "btns_fade": {
        click: "createFade"
    },

    "btn_save": {
        click: "save"
    },

    "btn_open": {
        click: "open"
    },
    
    "btn_trim_audio": {
        click: "trimAudio"
    },

    "time_format": {
        change: "changeTimeFormat"
    },

    "audio_start": {
        blur: "validateCueIn"
    },

    "audio_end": {
        blur: "validateCueOut"
    },

    "audio_pos": {

    },

    "audio_resolution": {
        change: "changeResolution"
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
        tmpBtn;

    makePublisher(this);

    this.ctrls = {};
    this.config = config;
    container = this.config.getContainer();
    state = this.config.getState();

    tmpBtn = document.getElementsByClassName("btn_"+state)[0];

    if (tmpBtn) {
        this.activateButton(tmpBtn);
    }

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

    if (this.ctrls["time_format"]) {
        this.ctrls["time_format"].value = this.config.getTimeFormat();
    }

    if (this.ctrls["audio_resolution"]) {
        this.ctrls["audio_resolution"].value = this.config.getResolution();
    }

    this.timeFormat = this.config.getTimeFormat();

    //Kept in seconds so time format change can update fields easily.
    this.currentSelectionValues = undefined;

    this.onCursorSelection({
        start: 0,
        end: 0
    });
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

        if (this.ctrls["audio_start"]) {
            this.ctrls["audio_start"].value = func(start);
        }

        if (this.ctrls["audio_end"]) {
            this.ctrls["audio_end"].value = func(end);
        }
    }
};

AudioControls.prototype.changeResolution = function(e) {
    var res = parseInt(e.target.value, 10);

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

    btns = el.getElementsByTagName("a");

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

    btns = el.getElementsByTagName("a");

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

AudioControls.prototype.playAudio = function() {

    this.fire('playaudio', this);
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

AudioControls.prototype.zeroCrossing = function(e) {
    var el = e.target,
        disabled,
        classes = this.classes;

    disabled = el.classList.contains(classes["disabled"]);

    if (!disabled) {
        this.fire('trackedit', {
            type: "zeroCrossing"
        });
    }  
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

AudioControls.prototype.removeAudio = function(e) {
    var el = e.target,
        disabled,
        classes = this.classes;

    disabled = el.classList.contains(classes["disabled"]);

    if (!disabled) {
        this.fire('trackedit', {
            type: "removeAudio"
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

    if (this.ctrls["audio_start"]) {
        this.ctrls["audio_start"].value = startFormat;
    }

    if (this.ctrls["audio_end"]) {
        this.ctrls["audio_end"].value = endFormat;
    }
};

/*
    args {seconds, pixels}
*/
AudioControls.prototype.onAudioUpdate = function(args) {
    if (this.ctrls["audio_pos"]) {
        this.ctrls["audio_pos"].innerHTML = this.cueFormatters(this.timeFormat)(args.seconds);
    } 
};

