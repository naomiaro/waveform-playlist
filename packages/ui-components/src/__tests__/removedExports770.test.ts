// @vitest-environment jsdom
//
// #770: names that had no caller, or a second owner, are not exported.
import './jsdom-polyfills'; // must be first
import { describe, it, expect } from 'vitest';
import * as uiComponents from '../index';

describe('ui-components exports (#770)', () => {
  it('does not export the unused context, the copy of core\'s conversions or the unused position display', () => {
    const names = Object.keys(uiComponents);
    for (const gone of [
      'TrackControlsContext',
      'useTrackControls',
      'samplesToPixels',
      'samplesToSeconds',
      'secondsToSamples',
      'secondsToPixels',
      'pixelsToSamples',
      'pixelsToSeconds',
      'AudioPosition',
    ]) {
      expect(names).not.toContain(gone);
    }
    // Still there: the kit the bound controls of browser are built from.
    expect(names).toEqual(
      expect.arrayContaining(['BaseCheckbox', 'TimeFormatSelect', 'usePlaylistInfo', 'TrackMenu'])
    );
  });
});
