/**
 * `createMixerGesture()` (#843): the id a range control passes to the mixer
 * setters while one gesture goes on, and the events of the control that end
 * it. The engine's tests run in node, which has `EventTarget` and `Event`
 * but no DOM; `attach` only listens and reads `key`, so a plain event
 * target stands in for the input.
 */
import { describe, it, expect, vi } from 'vitest';
import { createArrangement, createMixerGesture } from '../index';
import { createTrack } from '@waveform-playlist/core';
import type { ArrangementTrack } from '@waveform-playlist/core';

function fakeInput(): { input: HTMLInputElement; fire(type: string, key?: string): void } {
  const target = new EventTarget();
  return {
    input: target as unknown as HTMLInputElement,
    fire(type, key) {
      const event = new Event(type);
      if (key !== undefined) Object.defineProperty(event, 'key', { value: key });
      target.dispatchEvent(event);
    },
  };
}

const track = (id: string): ArrangementTrack => ({
  ...createTrack({ name: id, clips: [] }),
  id,
});

describe('createMixerGesture', () => {
  it('end gives a new id', () => {
    const gesture = createMixerGesture();
    const first = gesture.id;
    expect(gesture.id).toBe(first);
    gesture.end();
    expect(gesture.id).not.toBe(first);
  });

  it('change ends the gesture', () => {
    const gesture = createMixerGesture();
    const { input, fire } = fakeInput();
    gesture.attach(input);
    const first = gesture.id;
    fire('input');
    expect(gesture.id).toBe(first);
    fire('change');
    expect(gesture.id).not.toBe(first);
  });

  it('a change during a held key does not end it, keyup does', () => {
    const gesture = createMixerGesture();
    const { input, fire } = fakeInput();
    gesture.attach(input);
    const first = gesture.id;
    // A held arrow key: the browser repeats keydown, and a range input
    // fires change on each step.
    fire('keydown', 'ArrowUp');
    fire('change');
    fire('keydown', 'ArrowUp');
    fire('change');
    expect(gesture.id).toBe(first);
    fire('keyup', 'ArrowUp');
    expect(gesture.id).not.toBe(first);
    // The key is up: the next change ends the next gesture.
    const second = gesture.id;
    fire('change');
    expect(gesture.id).not.toBe(second);
  });

  it('a key that does not move a range control does not hold the gesture', () => {
    const gesture = createMixerGesture();
    const { input, fire } = fakeInput();
    gesture.attach(input);
    const first = gesture.id;
    fire('keydown', 'Shift');
    fire('change');
    expect(gesture.id).not.toBe(first);
    const second = gesture.id;
    fire('keyup', 'Shift');
    expect(gesture.id).toBe(second);
  });

  it('Page and Home/End keys hold it like an arrow', () => {
    for (const key of ['PageUp', 'PageDown', 'Home', 'End', 'ArrowLeft']) {
      const gesture = createMixerGesture();
      const { input, fire } = fakeInput();
      gesture.attach(input);
      const first = gesture.id;
      fire('keydown', key);
      fire('change');
      expect(gesture.id).toBe(first);
      fire('keyup', key);
      expect(gesture.id).not.toBe(first);
    }
  });

  it('blur ends it and forgets a held key', () => {
    const gesture = createMixerGesture();
    const { input, fire } = fakeInput();
    gesture.attach(input);
    const first = gesture.id;
    fire('keydown', 'ArrowUp');
    fire('blur');
    expect(gesture.id).not.toBe(first);
    // The keyup went to another element: a change after focus came back
    // ends the gesture as usual.
    const second = gesture.id;
    fire('change');
    expect(gesture.id).not.toBe(second);
  });

  it('detach removes the listeners', () => {
    const gesture = createMixerGesture();
    const { input, fire } = fakeInput();
    const detach = gesture.attach(input);
    detach();
    const first = gesture.id;
    fire('change');
    fire('keydown', 'ArrowUp');
    fire('keyup', 'ArrowUp');
    fire('blur');
    expect(gesture.id).toBe(first);
  });

  it('two helpers never share an id', () => {
    const ids = new Set<string>();
    const gestures = Array.from({ length: 5 }, () => createMixerGesture());
    for (const gesture of gestures) {
      ids.add(gesture.id);
      gesture.end();
      ids.add(gesture.id);
    }
    expect(ids.size).toBe(10);
  });

  it('two copies of the package never share an id', async () => {
    // Two fresh copies, so both counters are at the same place: without the
    // per-copy prefix their first ids would be equal.
    const fresh = async () => {
      vi.resetModules();
      return (await import('../index')) as typeof import('../index');
    };
    const one = await fresh();
    const two = await fresh();
    expect(one.createMixerGesture).not.toBe(two.createMixerGesture);
    expect(one.createMixerGesture().id).not.toBe(two.createMixerGesture().id);
  });

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
