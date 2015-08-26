'use strict';

WaveformPlaylist.AudioControls = {

    groups: {
        "audio-select": ["btns_audio_tools"]
    },

    classes: {
        "disabled": "disabled",
        "active": "active"
    },

    eventTypes: {
        "onclick": {
            "btn-rewind": "rewindAudio",
            "btn-fast-forward": "fastForwardAudio",
            "btn-play": "playAudio",
            "btn-pause": "pauseAudio",
            "btn-stop": "stopAudio",
            "btn-state": "changeState",
            "btn-save": "save",
            "btn-open": "open",
            "btn-trim-audio": "trimAudio",
            "btn-fade": "changeDefaultFade",
            "btn-zoom-in": "zoomIn",
            "btn-zoom-out": "zoomOut",
            "btn-new-track": "newTrack",
            "btn-mute": "muteTrack",
            "btn-solo": "soloTrack"
        },
        "onchange": {
            "time-format": "changeTimeFormat"
        },
        "oninput": {
            "volume-slider": "changeVolume"
        }
    },

    init: function() {
        var state,
            container,
            fadeType,
            tmpEl,
            tmpBtn;

        WaveformPlaylist.makePublisher(this);

        container = this.config.getContainer();
        state = this.config.getState();
        fadeType = this.config.getFadeType();

        //controls we should keep a reference to.
        this.ctrls = {};
        this.ctrls["time-format"] = container.querySelector(".time-format");
        this.ctrls["audio-start"] = container.querySelector(".audio-start");
        this.ctrls["audio-end"] = container.querySelector(".audio-end");
        this.ctrls["audio-pos"] = container.querySelector(".audio-pos");

        //set current state and fade type on playlist
        [".btn-state[data-state='"+state+"']", ".btn-fade[data-fade='"+fadeType+"']"].forEach(function(buttonClass) {
            tmpBtn = container.querySelector(buttonClass);

            if (tmpBtn) {
                this.activateButton(tmpBtn);
            }
        }, this);  

        Object.keys(this.eventTypes).forEach(function(event) {
            var that = this;

            //all events are delegated to the main container.
            (function(eventName, classNames) {
                container[eventName] = function(e) {
                    //check if the event target has a special class name.
                    var data = that.nodeChainContainsClassName(e.currentTarget, e.target, classNames);
                    var className;

                    if (data && (className = data['className'])) {
                        that[that.eventTypes[eventName][className]].call(that, e);
                    }
                };
            })(event, Object.keys(this.eventTypes[event]));

        }, this);

        if (this.ctrls["time-format"]) {
            this.ctrls["time-format"].value = this.config.getTimeFormat();
        }

        //TODO, need better alternative? onfocusout not in firefox and blur doesn't bubble.
        if (this.ctrls["time-format"]) {
            this.ctrls["audio-start"].onblur = this.validateCueIn.bind(this);
        }
        if (this.ctrls["time-format"]) {
            this.ctrls["audio-end"].onblur = this.validateCueOut.bind(this);
        }

        this.timeFormat = this.config.getTimeFormat();

        //Kept in seconds so time format change can update fields easily.
        this.currentSelectionValues = undefined;

        this.onCursorSelection({
            start: 0,
            end: 0
        });
    },

    nodeChainContainsClassName: function(parent, node, classNames) {
        var i, len, className, currentNode;

        currentNode = node;

        while (currentNode) {
            for (i = 0, len = classNames.length; i < len; i++) {
                className = classNames[i];
                if (currentNode.classList.contains(className)) {
                    return {
                        'className': className,
                        'node': currentNode
                    };
                }
            }

            if (currentNode === parent) {
                break;
            }
            currentNode = currentNode.parentElement; 
        }   
    },

    validateCue: function(value) {
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
    },

    cueToSeconds: function(value) {
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
    },

    cueFormatters: function(format) {

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
    },

    changeTimeFormat: function(e) {
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
    },

    zoomIn: function() {
        var newRes = this.config.getResolution() * (3/4),
            min = this.config.getMinResolution();

        newRes = (newRes < min) ? min : newRes;

        if (newRes > min) {
            this.zoom(newRes);
        }
    },

    zoomOut: function() {
        var newRes = this.config.getResolution() * (4/3),
            max = this.config.getMaxResolution();

        newRes = (newRes > max) ? max : newRes;

        if (newRes < max) {
            this.zoom(newRes);
        }
    },

    zoom: function(res) {
        this.config.setResolution(res);
        this.fire("changeresolution", res);
    },

    newTrack: function() {
        this.fire("newtrack");
    },

    validateCueIn: function(e) {
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
    },

    validateCueOut: function(e) {
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
    },

    activateButtonGroup: function(id) {
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
    },

    deactivateButtonGroup: function(id) {
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
    },

    activateAudioSelection: function() {
        var ids = this.groups["audio-select"],
            i, len;

        for (i = 0, len = ids.length; i < len; i++) {
            this.activateButtonGroup(ids[i]);
        }
    },

    deactivateAudioSelection: function() {
        var ids = this.groups["audio-select"],
            i, len;

        for (i = 0, len = ids.length; i < len; i++) {
            this.deactivateButtonGroup(ids[i]);
        }
    },

    save: function() {
        this.fire('playlistsave');
    },

    open: function() {
        this.fire('playlistrestore');
    },

    rewindAudio: function() {
        this.fire('rewindaudio');
    },

    fastForwardAudio: function() {
        this.fire('fastforwardaudio');
    },

    playAudio: function() {
        this.fire('playaudio');
    },

    pauseAudio: function() {
        this.fire('pauseaudio');
    },

    stopAudio: function() {
        this.fire('stopaudio');
    },

    changeVolume: function(e) {
        var container = this.config.getContainer();
        var track = this.nodeChainContainsClassName(e.currentTarget, e.target, ["channel-wrapper"])["node"];

        this.fire('changevolume', {
            trackElement: track,
            gain: e.target.value/100
        });
    },

    muteTrack: function(e) {
        var el = this.nodeChainContainsClassName(e.currentTarget, e.target, ["btn-mute"])["node"];
        var track = this.nodeChainContainsClassName(e.currentTarget, el, ["channel-wrapper"])["node"];

        el.classList.toggle(this.classes["active"]);

        this.fire('mutetrack', track);
    },

    soloTrack: function(e) {
        var el = this.nodeChainContainsClassName(e.currentTarget, e.target, ["btn-solo"])["node"];
        var track = this.nodeChainContainsClassName(e.currentTarget, el, ["channel-wrapper"])["node"];

        el.classList.toggle(this.classes["active"]);

        this.fire('solotrack', track);
    },

    activateButton: function(el) {
        if (el) {
            el.classList.add(this.classes["active"]);
        }
    },

    deactivateButton: function(el) {
        if (el) {
            el.classList.remove(this.classes["active"]);
        }
    },

    enableButton: function(el) {
        if (el) {
            el.classList.remove(this.classes["disabled"]);
        }
    },

    disableButton: function(el) {
        if (el) {
            el.classList.add(this.classes["disabled"]);
        }
    },

    changeState: function(e) {
        var nodeData = this.nodeChainContainsClassName(e.currentTarget, e.target, ['btn-state']),
            el = nodeData['node'],
            prevEl = el.parentElement.querySelector('.active'),
            state = el.dataset.state;

        this.deactivateButton(prevEl);
        this.activateButton(el);

        this.config.setState(state);
        this.fire('changestate');
    },

    changeDefaultFade: function(e) {
        var nodeData = this.nodeChainContainsClassName(e.currentTarget, e.target, ['btn-fade']),
            el = nodeData['node'],
            prevEl = el.parentElement.querySelector('.active'),
            type = el.dataset.fade;

        this.deactivateButton(prevEl);
        this.activateButton(el);

        this.config.setFadeType(type);
    },

    trimAudio: function(e) {
        var el = e.target,
            disabled,
            classes = this.classes;

        disabled = el.classList.contains(classes["disabled"]);

        if (!disabled) {
            this.fire('trackedit', {
                type: "trimAudio"
            });
        }  
    },

    createFade: function(e) {
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
    },

    onAudioSelection: function() {
        this.activateAudioSelection();
    },

    onAudioDeselection: function() {
        this.deactivateAudioSelection();
    },

    /*
        start, end in seconds
    */
    notifySelectionUpdate: function(start, end) {
        this.fire('changeselection', {
            start: start,
            end: end
        });
    },

    /*
        start, end in seconds
    */
    onCursorSelection: function(args) {
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
    },

    /*
        args {seconds, pixels}
    */
    onAudioUpdate: function(args) {
        if (this.ctrls["audio-pos"]) {
            this.ctrls["audio-pos"].innerHTML = this.cueFormatters(this.timeFormat)(args.seconds);
        } 
    }
};
