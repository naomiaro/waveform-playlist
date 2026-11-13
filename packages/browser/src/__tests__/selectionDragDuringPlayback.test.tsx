// @vitest-environment jsdom
//
// The selection drag of a waveform view (`useSelectionDrag`), under hand-built
// contexts: one pixel is 0.02 s (50 px per second), and the pressed element is
// 1000 px wide.
//
// While playback runs, nothing is committed before the release. With automatic
// scroll off the moves publish a preview and the release sets the range (or
// seeks, for a click); with it on a press and its release are one seek.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { ThemeProvider } from 'styled-components';
import { defaultTheme } from '@waveform-playlist/ui-components';
import type { ValueSource } from '@waveform-playlist/core';
import {
  IsPlayingContext,
  PlaybackControlsContext,
  SelectionContext,
  PlaylistSettingsContext,
  PlaylistViewContext,
  PlaylistZoomContext,
  type PlaybackControlsContextValue,
  type PlaylistViewContextValue,
} from '../contexts/playlistContexts';
import {
  useSelectionDrag,
  AutomaticScrollFlag,
  SelectionPreviewContext,
  type SelectionRange,
} from '../hooks/useSelectionDrag';
import { SelectionOverlay } from '../components/VisualizationOverlays';

const setSelection = vi.fn();
const onPress = vi.fn();
const onClickWhileStopped = vi.fn();
const CONTROLS = { setSelection } as unknown as PlaybackControlsContextValue;

let preview: ValueSource<SelectionRange | null>;

const Surface: React.FC = () => {
  const drag = useSelectionDrag({
    samplesPerPixel: 20,
    sampleRate: 1000,
    onPress,
    onClickWhileStopped,
  });
  preview = drag.preview;
  return (
    <>
      <AutomaticScrollFlag flagRef={drag.automaticScrollRef} />
      <div
        data-surface=""
        data-selecting={drag.isSelecting ? 'true' : 'false'}
        onMouseDown={drag.handleMouseDown}
        ref={(element) => {
          if (element) {
            // jsdom lays nothing out.
            element.getBoundingClientRect = () =>
              ({ left: 0, top: 20, right: 1000, bottom: 120, width: 1000, height: 100 }) as DOMRect;
          }
        }}
      />
    </>
  );
};

interface Scene {
  isPlaying: boolean;
  isAutomaticScroll?: boolean;
}

function mount(initial: Scene) {
  const ui = ({ isPlaying, isAutomaticScroll = false }: Scene) => (
    <PlaybackControlsContext.Provider value={CONTROLS}>
      <PlaylistSettingsContext.Provider value={{ timeFormat: 'hh:mm:ss.uuu', isAutomaticScroll }}>
        <IsPlayingContext.Provider value={{ isPlaying }}>
          <Surface />
        </IsPlayingContext.Provider>
      </PlaylistSettingsContext.Provider>
    </PlaybackControlsContext.Provider>
  );
  const utils = render(ui(initial));
  return { set: (scene: Scene) => utils.rerender(ui(scene)) };
}

const surface = () => document.querySelector('[data-surface]') as HTMLElement;

async function press(x: number, y = 10) {
  await act(async () => {
    fireEvent.mouseDown(surface(), { button: 0, clientX: x, clientY: y });
  });
}
async function move(x: number) {
  await act(async () => {
    fireEvent.mouseMove(window, { buttons: 1, clientX: x, clientY: 10 });
  });
}
async function release(x: number) {
  await act(async () => {
    fireEvent.mouseUp(window, { button: 0, clientX: x, clientY: 10 });
  });
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.clearAllMocks();
});

describe('what starts a drag', () => {
  it('only the primary button: a right-click starts nothing', async () => {
    mount({ isPlaying: false });
    await act(async () => {
      fireEvent.mouseDown(surface(), { button: 2, clientX: 200, clientY: 30 });
    });
    expect(onPress).not.toHaveBeenCalled();
    expect(setSelection).not.toHaveBeenCalled();
    expect(surface().dataset.selecting).toBe('false');
  });

  it('a click during playback to the left of the element seeks to 0, not to a negative time', async () => {
    mount({ isPlaying: true });
    await press(-50);
    await release(-50);
    expect(setSelection.mock.calls).toEqual([[0, 0]]);
  });
});

describe('while stopped the selection follows the pointer', () => {
  it('press, move and release each write the selection; nothing is previewed', async () => {
    mount({ isPlaying: false });

    await press(200, 37);
    expect(onPress).toHaveBeenCalledWith({ time: 4, offsetY: 17, isPlaying: false });
    expect(setSelection.mock.calls).toEqual([[4, 4]]);
    expect(surface().dataset.selecting).toBe('true');

    await move(350);
    expect(setSelection).toHaveBeenLastCalledWith(4, 7);
    // To the left of the press: ordered, anchored at the press.
    await move(120);
    expect(setSelection).toHaveBeenLastCalledWith(2.4, 4);
    expect(preview.getSnapshot()).toBeNull();

    await release(90);
    expect(setSelection).toHaveBeenLastCalledWith(1.8, 4);
    expect(onClickWhileStopped).not.toHaveBeenCalled();
    expect(surface().dataset.selecting).toBe('false');
  });

  it('a click hands its time to onClickWhileStopped', async () => {
    mount({ isPlaying: false });
    await press(200);
    await release(202);
    expect(setSelection.mock.calls).toEqual([[4, 4]]);
    expect(onClickWhileStopped.mock.calls).toEqual([[4]]);
  });

  it('the automatic scroll makes no difference while stopped', async () => {
    mount({ isPlaying: false, isAutomaticScroll: true });
    await press(200);
    await move(350);
    await release(350);
    expect(setSelection.mock.calls).toEqual([
      [4, 4],
      [4, 7],
      [4, 7],
    ]);
  });
});

describe('while playing, with automatic scroll off, nothing is committed before the release', () => {
  it('the press does not touch the selection', async () => {
    mount({ isPlaying: true });
    await press(200, 37);
    expect(onPress).toHaveBeenCalledWith({ time: 4, offsetY: 17, isPlaying: true });
    expect(setSelection).not.toHaveBeenCalled();
    expect(surface().dataset.selecting).toBe('true');
    expect(preview.getSnapshot()).toBeNull();
  });

  it('moves publish the range as a preview, ordered, and do not touch the selection', async () => {
    mount({ isPlaying: true });
    await press(200);
    await move(350);
    expect(preview.getSnapshot()).toEqual({ start: 4, end: 7 });
    await move(120);
    expect(preview.getSnapshot()).toEqual({ start: 2.4, end: 4 });
    expect(setSelection).not.toHaveBeenCalled();
  });

  it('a range shorter than 0.1 s is not previewed, and a longer one that shrinks back is withdrawn', async () => {
    mount({ isPlaying: true });
    await press(200);
    await move(204); // 0.08 s
    expect(preview.getSnapshot()).toBeNull();
    await move(350);
    expect(preview.getSnapshot()).not.toBeNull();
    await move(201);
    expect(preview.getSnapshot()).toBeNull();
  });

  it('the release of a drag sets the range once and clears the preview', async () => {
    mount({ isPlaying: true });
    await press(200);
    await move(350);
    await release(360);
    expect(setSelection.mock.calls).toEqual([[4, 7.2]]);
    expect(preview.getSnapshot()).toBeNull();
    expect(onClickWhileStopped).not.toHaveBeenCalled();
    expect(surface().dataset.selecting).toBe('false');
  });

  it('the release of a click moves playback to where the PRESS landed, once', async () => {
    mount({ isPlaying: true });
    await press(200);
    // The pointer drifted two pixels to the left (0.04 s): still a click, and
    // at the press (4 s), not at the start of that tiny range (3.96 s).
    await release(198);
    expect(setSelection.mock.calls).toEqual([[4, 4]]);
    expect(onClickWhileStopped).not.toHaveBeenCalled();
  });

  it('a drag that returns to the press is a click', async () => {
    mount({ isPlaying: true });
    await press(200);
    await move(350);
    await release(199);
    expect(setSelection.mock.calls).toEqual([[4, 4]]);
    expect(preview.getSnapshot()).toBeNull();
  });

  it('a drag that loses the window is dropped: no selection, no preview', async () => {
    mount({ isPlaying: true });
    await press(200);
    await move(350);
    expect(preview.getSnapshot()).not.toBeNull();
    await act(async () => {
      fireEvent.blur(window);
    });
    expect(setSelection).not.toHaveBeenCalled();
    expect(preview.getSnapshot()).toBeNull();
    expect(surface().dataset.selecting).toBe('false');
  });

  it('when playback stops under the drag it goes on as an ordinary drag', async () => {
    const { set } = mount({ isPlaying: true });
    await press(200);
    await move(350);
    expect(setSelection).not.toHaveBeenCalled();

    await act(async () => {
      set({ isPlaying: false });
    });
    await move(400);
    expect(preview.getSnapshot()).toBeNull();
    expect(setSelection).toHaveBeenLastCalledWith(4, 8);

    await release(420);
    expect(setSelection).toHaveBeenLastCalledWith(4, 8.4);
  });
});

describe('edges of a drag that outlives the state it began in', () => {
  it('pressed while playing, playback ended, released without moving: the selection collapses at the press, as for any click', async () => {
    const { set } = mount({ isPlaying: true });
    await press(200);
    expect(setSelection).not.toHaveBeenCalled();
    await act(async () => {
      set({ isPlaying: false });
    });
    await release(200);
    // The press did not collapse the selection (playback was running), so
    // the release has to: otherwise an old highlighted range would stay.
    expect(setSelection.mock.calls).toEqual([[4, 4]]);
    expect(onClickWhileStopped).not.toHaveBeenCalled();
  });

  it('a range drawn while playing, playback ended, released without a further move: the range becomes the selection', async () => {
    const { set } = mount({ isPlaying: true });
    await press(200);
    await move(350);
    expect(preview.getSnapshot()).toEqual({ start: 4, end: 7 });
    await act(async () => {
      set({ isPlaying: false });
    });
    await release(350);
    expect(setSelection.mock.calls).toEqual([[4, 7]]);
    expect(onClickWhileStopped).not.toHaveBeenCalled();
    expect(preview.getSnapshot()).toBeNull();
  });

  it('automatic scroll switched on after a range was already drawn: the drawing is withdrawn at the next move', async () => {
    const { set } = mount({ isPlaying: true, isAutomaticScroll: false });
    await press(200);
    await move(350);
    expect(preview.getSnapshot()).toEqual({ start: 4, end: 7 });
    await act(async () => {
      set({ isPlaying: true, isAutomaticScroll: true });
    });
    await move(400);
    expect(preview.getSnapshot()).toBeNull();
    await release(400);
    expect(setSelection.mock.calls).toEqual([[4, 4]]);
  });
});

describe('the automatic-scroll setting is followed after mount', () => {
  it('switched on during playback: the next drag draws nothing and seeks to the press', async () => {
    const { set } = mount({ isPlaying: true, isAutomaticScroll: false });
    await act(async () => {
      set({ isPlaying: true, isAutomaticScroll: true });
    });
    await press(200);
    await move(350);
    expect(preview.getSnapshot()).toBeNull();
    await release(350);
    expect(setSelection.mock.calls).toEqual([[4, 4]]);
  });

  it('switched off again: the next drag is a range', async () => {
    const { set } = mount({ isPlaying: true, isAutomaticScroll: true });
    await act(async () => {
      set({ isPlaying: true, isAutomaticScroll: false });
    });
    await press(200);
    await move(350);
    expect(preview.getSnapshot()).toEqual({ start: 4, end: 7 });
    await release(350);
    expect(setSelection.mock.calls).toEqual([[4, 7]]);
  });
});

describe('while playing, with automatic scroll on, a press and its release are one seek', () => {
  it('the press and the moves change nothing and preview nothing', async () => {
    mount({ isPlaying: true, isAutomaticScroll: true });
    await press(200);
    await move(350);
    await move(120);
    expect(setSelection).not.toHaveBeenCalled();
    expect(preview.getSnapshot()).toBeNull();
    expect(surface().dataset.selecting).toBe('true');
  });

  it('the release seeks once, to where the press landed, however far the pointer went', async () => {
    mount({ isPlaying: true, isAutomaticScroll: true });
    await press(200);
    await move(350);
    await release(500);
    expect(setSelection.mock.calls).toEqual([[4, 4]]);
    expect(onClickWhileStopped).not.toHaveBeenCalled();
    expect(surface().dataset.selecting).toBe('false');
  });

  it('a plain click seeks once', async () => {
    mount({ isPlaying: true, isAutomaticScroll: true });
    await press(200);
    await release(200);
    expect(setSelection.mock.calls).toEqual([[4, 4]]);
  });

  it('a drag that loses the window seeks nowhere', async () => {
    mount({ isPlaying: true, isAutomaticScroll: true });
    await press(200);
    await act(async () => {
      fireEvent.blur(window);
    });
    expect(setSelection).not.toHaveBeenCalled();
  });
});

describe('the selection highlight shows the preview in place of the selection', () => {
  const VIEW = { sampleRate: 1000 } as unknown as PlaylistViewContextValue;
  const ZOOM = { samplesPerPixel: 1000, canZoomIn: false, canZoomOut: false };

  function highlight(): { left: string; width: string } | null {
    const element = document.querySelector('[data-selection]') as HTMLElement | null;
    return element ? { left: element.style.left, width: element.style.width } : null;
  }

  it('draws the selection, then the preview while there is one, then the selection again', async () => {
    const { createValueSource } = await import('@waveform-playlist/core');
    const handle = createValueSource<SelectionRange | null>(null);
    render(
      <ThemeProvider theme={defaultTheme}>
        <PlaylistViewContext.Provider value={VIEW}>
          <PlaylistZoomContext.Provider value={ZOOM}>
            <SelectionContext.Provider value={{ selectionStart: 10, selectionEnd: 30 }}>
              <SelectionPreviewContext.Provider value={handle.source}>
                <SelectionOverlay />
              </SelectionPreviewContext.Provider>
            </SelectionContext.Provider>
          </PlaylistZoomContext.Provider>
        </PlaylistViewContext.Provider>
      </ThemeProvider>
    );
    expect(highlight()).toEqual({ left: '10px', width: '20px' });

    await act(async () => {
      handle.publish({ start: 100, end: 160 });
    });
    expect(document.querySelectorAll('[data-selection]').length).toBe(1);
    expect(highlight()).toEqual({ left: '100px', width: '60px' });

    await act(async () => {
      handle.publish(null);
    });
    expect(highlight()).toEqual({ left: '10px', width: '20px' });
  });

  it('with no preview source above (no view around it) it draws the selection', () => {
    render(
      <ThemeProvider theme={defaultTheme}>
        <PlaylistViewContext.Provider value={VIEW}>
          <PlaylistZoomContext.Provider value={ZOOM}>
            <SelectionContext.Provider value={{ selectionStart: 10, selectionEnd: 30 }}>
              <SelectionOverlay />
            </SelectionContext.Provider>
          </PlaylistZoomContext.Provider>
        </PlaylistViewContext.Provider>
      </ThemeProvider>
    );
    expect(highlight()).toEqual({ left: '10px', width: '20px' });
  });
});
