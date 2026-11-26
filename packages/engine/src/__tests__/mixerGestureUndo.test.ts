/**
 * `createMixerGesture()` from core with the arrangement's mixer setters
 * (#843): the changes of one drag are one undo step. The helper's own events
 * are tested in core (`mixerGesture.test.ts`); here a plain event target
 * stands in for the input, since the engine's tests run in node.
 */
import { describe, it, expect } from 'vitest';
import { createMixerGesture, createTrack } from '@waveform-playlist/core';
import type { ArrangementTrack } from '@waveform-playlist/core';
import { createArrangement } from '../index';

function fakeInput(): { input: HTMLInputElement; fire(type: string): void } {
  const target = new EventTarget();
  return {
    input: target as unknown as HTMLInputElement,
    fire(type) {
      target.dispatchEvent(new Event(type));
    },
  };
}

const track = (id: string): ArrangementTrack => ({
  ...createTrack({ name: id, clips: [] }),
  id,
});

describe('createMixerGesture with an arrangement', () => {
  it('one drag is one undo step; the next drag is another', () => {
    const arrangement = createArrangement({ tracks: [track('A')] });
    const gesture = createMixerGesture();
    const { input, fire } = fakeInput();
    gesture.attach(input);

    for (const volume of [0.9, 0.8, 0.7]) {
      arrangement.setTrackVolume('A', volume, { gesture: gesture.id });
      fire('input');
    }
    fire('change');
    for (const volume of [0.6, 0.5]) {
      arrangement.setTrackVolume('A', volume, { gesture: gesture.id });
    }
    fire('change');

    arrangement.undo();
    expect(arrangement.getMixer().get('A')?.volume).toBe(0.7);
    arrangement.undo();
    expect(arrangement.getMixer().get('A')?.volume).toBe(1);
    expect(arrangement.canUndo).toBe(false);
  });
});
