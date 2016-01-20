'use strict';

import {expect} from 'chai';
import {secondsToPixels} from './../../src/utils/conversions';

describe('Util Conversions', function() {

    it('calculates the requested number of peaks', function() {
        expect(secondsToPixels(1, 2048, 44100)).to.equal(22);
    });
});