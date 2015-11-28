'use strict';

import {expect} from 'chai';
import peaks from '../src/waveform/utils/peaks';

describe('peak extractor', function() {
    it('min peaks should be zeros for a zero array', function() {
        var result = peaks(new Float32Array(5), 1);
        expect(result.minPeaks).to.deep.equal(new Float32Array(5));
    });
    it('max peaks should be zeros for a zero array', function() {
        var result = peaks(new Float32Array(5), 1);
        expect(result.maxPeaks).to.deep.equal(new Float32Array(5));
    });
    it('max peak should be zero for a zero array', function() {
        var result = peaks(new Float32Array(5), 1);
        expect(result.maxPeak).to.equal(0);
    });
});