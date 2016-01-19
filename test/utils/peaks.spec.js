'use strict';

//import "web-audio-test-api";

import {expect} from 'chai';
import peaks from './../../src/utils/peaks';

describe('peak extractor', function() {
    var ac = new AudioContext();
    var decodedAudio;
    
    before(function() {
        return new Promise(function(resolve, reject) {
            var req = new XMLHttpRequest();
            req.open('GET', "/base/test/media/silence.ogg");
            req.responseType = 'arraybuffer';

            req.onload = function() {
                ac.decodeAudioData(req.response, function(buffer) {
                    decodedAudio = buffer;
                    resolve(buffer);
                  },
                  function(e) {
                    reject(e);
                  });
            };

            req.onerror = function() {
                reject(Error('Network Error'));
            };

            req.send();
        });
    });

    describe('Peaks extractor', function() {
        it('calculates the requested number of peaks', function() {
            var result = peaks(decodedAudio, 1, true);
            expect(decodedAudio.sampleRate).to.equal(result.length);
            expect(decodedAudio.sampleRate*2).to.equal(result.data[0].length)
        });
    });
});