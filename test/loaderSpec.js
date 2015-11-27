'use strict';

require("web-audio-test-api");

import {expect} from 'chai';
import BlobLoader from '../src/waveform/track/loader/BlobLoader';

describe('blob loader', function() {
    var ac = new AudioContext();

    before(function() {
        var oReq = new XMLHttpRequest();
        oReq.open("GET", "../media/stems/Vocals30.mp3", true);
        oReq.responseType = "blob";

        oReq.onload = function(oEvent) {
          var blob = oReq.response;
        };

        oReq.send();
    });


    it('should be able to load blob', function() {
        let loader = new BlobLoader();
    });
});