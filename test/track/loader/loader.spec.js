'use strict';

require('web-audio-test-api');

import {expect} from 'chai';
import XHRLoader from './../../../src/track/loader/XHRLoader';
import BlobLoader from './../../../src/track/loader/BlobLoader';

describe('Audio Loaders', function() {
    var ac = new AudioContext();
    var blob;
    var arrayBuffer;
    var decodedAudio;
    var url = '/base/media/stems/Vocals30.mp3';

    /*
    * This is a lot of setup, but not sure how else I should get the blob/array buffer data to compare to.
    */
    before(function() {
        return new Promise(function(resolve, reject) {
            var req = new XMLHttpRequest();
            req.open('GET', url);
            req.responseType = 'arraybuffer';

            req.onload = function() {
                arrayBuffer = req.response;
                blob = new Blob([arrayBuffer], {type : 'audio/mp3'});
                resolve(req.response);
            };

            req.onerror = function() {
                reject(Error('Network Error'));
            };

            req.send();
        }).then(function(arraybuffer) {
            return new Promise(function(resolve, reject) {
                ac.decodeAudioData(arraybuffer, function(buffer) {
                    decodedAudio = buffer;
                    resolve(buffer);
                }, function() {
                    reject(Error("Audio didn't decode"));
                });
            });
        });
    });

    describe('XHRLoader', function() {
        it('should load arraybuffer from url', function(done) {
            let loader = new XHRLoader(url, ac);
            loader.load().then(function(result) {
                expect(result.byteLength).to.equal(decodedAudio.byteLength);
                expect(new Float32Array(result)).to.deep.equal(new Float32Array(decodedAudio));
                done();
            }, function(err) {
                done(err);
            });
        });
    });

    describe('BlobLoader', function() {
        it('should load arraybuffer from blob', function(done) {
            let loader = new BlobLoader(blob, ac);
            loader.load().then(function(result) {
                expect(result.byteLength).to.equal(decodedAudio.byteLength);
                expect(new Float32Array(result)).to.deep.equal(new Float32Array(decodedAudio));
                done();
            }, function(err) {
                done(err);
            });
        });
    });
});