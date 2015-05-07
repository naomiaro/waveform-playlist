'use strict';

WaveformPlaylist.mixin = function(object, mixin) {
    Object.keys(mixin).forEach(function(key) {
        object[key] = mixin[key];
    });
};