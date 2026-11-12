// #699: PianoRollChannel and TimeScale redrew every mounted canvas chunk whenever
// the set of visible chunks changed. Like Channel, they now stamp each canvas
// with the parameters it was drawn with and skip the ones that are current.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render as rtlRender, cleanup, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import type { MidiNoteData } from '@waveform-playlist/core';

// Without a ScrollViewportProvider every chunk is "visible". The tests control
// the visible set directly to simulate scrolling.
let visibleChunks: number[] = [];
vi.mock('../contexts/ScrollViewport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../contexts/ScrollViewport')>()),
  useVisibleChunkIndices: () => visibleChunks,
}));

import { PianoRollChannel } from '../components/PianoRollChannel';
import { SmartChannel } from '../components/SmartChannel';
import { StyledTimeScale, type PrecomputedTickData } from '../components/TimeScale';
import { SmartScale } from '../components/SmartScale';
import { defaultTheme } from '../wfpl-theme';
import { PlaylistInfoContext, usePlaylistInfo } from '../contexts/PlaylistInfo';
import { BeatsAndBarsProvider } from '../contexts/BeatsAndBars';

// TimeScale reads its tick colour from the theme.
const Themed: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={defaultTheme}>{children}</ThemeProvider>
);
const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: Themed });

interface ChunkLog {
  clears: number;
  fillRects: Array<[number, number, number, number]>;
  roundRects: number;
}

/** Draw calls per chunk index (the canvas's data-index). */
let log: Map<number, ChunkLog>;

function chunkLog(canvas: HTMLCanvasElement): ChunkLog {
  const index = Number(canvas.dataset.index);
  let entry = log.get(index);
  if (!entry) {
    entry = { clears: 0, fillRects: [], roundRects: 0 };
    log.set(index, entry);
  }
  return entry;
}

beforeEach(() => {
  log = new Map();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement
  ) {
    const entry = chunkLog(this);
    return {
      resetTransform() {},
      scale() {},
      beginPath() {},
      fill() {},
      clearRect() {
        entry.clears++;
      },
      fillRect(x: number, y: number, w: number, h: number) {
        entry.fillRects.push([x, y, w, h]);
      },
      roundRect() {
        entry.roundRects++;
      },
    } as unknown as CanvasRenderingContext2D;
  } as unknown as HTMLCanvasElement['getContext']);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const clears = () =>
  Object.fromEntries([...log.entries()].sort(([a], [b]) => a - b).map(([i, e]) => [i, e.clears]));

const NOTES: MidiNoteData[] = [
  { midi: 60, name: 'C4', time: 0.5, duration: 0.5, velocity: 0.8 },
  { midi: 64, name: 'E4', time: 25, duration: 0.5, velocity: 0.8 },
  { midi: 67, name: 'G4', time: 45, duration: 0.5, velocity: 0.8 },
];

// 48 px per second: chunk 0 = 0..20.8 s, chunk 1 = ..41.7 s, chunk 2 = ..62.5 s
const pianoProps = {
  index: 0,
  midiNotes: NOTES,
  length: 3000,
  waveHeight: 80,
  devicePixelRatio: 1,
  samplesPerPixel: 1000,
  sampleRate: 48000,
  clipOffsetSeconds: 0,
};

describe('PianoRollChannel', () => {
  it('draws only the chunk that scrolled into view', () => {
    visibleChunks = [0, 1];
    const { rerender } = render(<PianoRollChannel {...pianoProps} />);
    expect(clears()).toEqual({ 0: 1, 1: 1 });

    visibleChunks = [1, 2];
    rerender(<PianoRollChannel {...pianoProps} />);
    expect(clears()).toEqual({ 0: 1, 1: 1, 2: 1 });
    expect(log.get(2)!.roundRects).toBe(1);
  });

  it('redraws every chunk when a drawing parameter changes', () => {
    visibleChunks = [0, 1];
    const { rerender } = render(<PianoRollChannel {...pianoProps} />);

    rerender(<PianoRollChannel {...pianoProps} isSelected />);
    expect(clears()).toEqual({ 0: 2, 1: 2 });

    rerender(<PianoRollChannel {...pianoProps} isSelected samplesPerPixel={500} />);
    expect(clears()).toEqual({ 0: 3, 1: 3 });
  });

  it('redraws when the height changes (resizing a canvas clears it)', () => {
    visibleChunks = [0, 1];
    const { rerender } = render(<PianoRollChannel {...pianoProps} />);
    rerender(<PianoRollChannel {...pianoProps} waveHeight={120} />);
    expect(clears()).toEqual({ 0: 2, 1: 2 });
  });

  it('redraws when the notes are replaced, even by an equal list', () => {
    visibleChunks = [0];
    const { rerender } = render(<PianoRollChannel {...pianoProps} />);
    rerender(<PianoRollChannel {...pianoProps} midiNotes={[...NOTES]} />);
    expect(clears()).toEqual({ 0: 2 });
  });

  it('does not redraw on a re-render with the same props', () => {
    visibleChunks = [0, 1];
    const { rerender } = render(<PianoRollChannel {...pianoProps} />);
    rerender(<PianoRollChannel {...pianoProps} />);
    expect(clears()).toEqual({ 0: 1, 1: 1 });
  });
});

describe('SmartChannel draws a piano roll for a clip with notes', () => {
  const base = { index: 0, data: new Int8Array(0), bits: 8 as const, length: 500 };
  // One array for all renders: a new array is a new drawing.
  const noNotes: MidiNoteData[] = [];

  it('does not redraw on re-render while the note list keeps its identity', () => {
    visibleChunks = [0];
    const props = { ...base, midiNotes: noNotes };
    const { container, rerender } = render(<SmartChannel {...props} />);
    rerender(<SmartChannel {...props} />);
    rerender(<SmartChannel {...props} />);
    expect(container.querySelector('[data-piano-roll]')).not.toBeNull();
    expect(clears()).toEqual({ 0: 1 });
  });

  it('whatever the render mode, and an empty note list is still a MIDI clip', () => {
    visibleChunks = [0];
    for (const renderMode of ['waveform', 'spectrogram', 'both'] as const) {
      const { container, unmount } = render(
        <SmartChannel {...base} renderMode={renderMode} midiNotes={noNotes} />
      );
      expect(container.querySelector('[data-piano-roll]')).not.toBeNull();
      unmount();
    }
  });

  it('also when the spectrogram props are present: notes win over a spectrogram mode', () => {
    visibleChunks = [0];
    const register = vi.fn();
    for (const renderMode of ['spectrogram', 'both'] as const) {
      const { container, unmount } = render(
        <SmartChannel
          {...base}
          renderMode={renderMode}
          midiNotes={noNotes}
          spectrogramClipId="clip-1"
          spectrogramOnCanvasRegister={register}
          spectrogramOnCanvasUnregister={vi.fn()}
        />
      );
      expect(container.querySelector('[data-piano-roll]')).not.toBeNull();
      unmount();
    }
    expect(register).not.toHaveBeenCalled();
  });

  it('a clip without notes is not a piano roll, and null is not notes', () => {
    visibleChunks = [0];
    const { container, unmount } = render(<SmartChannel {...base} />);
    expect(container.querySelector('[data-piano-roll]')).toBeNull();
    unmount();
    // Plain-JS data: core's clipKind reads a null midiNotes as an audio clip.
    const nullNotes = null as unknown as MidiNoteData[];
    const second = render(<SmartChannel {...base} midiNotes={nullNotes} />);
    expect(second.container.querySelector('[data-piano-roll]')).toBeNull();
  });
});

function tickData(canvasInfo: Map<number, number>, label = 'a'): PrecomputedTickData {
  return {
    widthX: 3000,
    canvasInfo,
    timeMarkersWithPositions: [{ pix: 0, element: <span key="m">{label}</span> }],
  };
}

// The context's default value, read once through the hook.
let playlistInfoDefaults: ReturnType<typeof usePlaylistInfo>;
const CaptureDefaults: React.FC = () => {
  playlistInfoDefaults = usePlaylistInfo();
  return null;
};

describe('TimeScale', () => {
  beforeEach(() => {
    rtlRender(<CaptureDefaults />);
    cleanup();
  });

  const TICKS = new Map<number, number>([
    [0, 15],
    [500, 7],
    [1000, 15],
    [1250, 3],
    [2999, 7],
  ]);

  it('draws each tick in its own chunk, at the chunk-local x', () => {
    visibleChunks = [0, 1, 2];
    render(<StyledTimeScale tickData={tickData(TICKS)} />);

    expect(log.get(0)!.fillRects).toEqual([
      [0, 0, 1, 15],
      [500, 8, 1, 7],
    ]);
    expect(log.get(1)!.fillRects).toEqual([
      [0, 0, 1, 15],
      [250, 12, 1, 3],
    ]);
    expect(log.get(2)!.fillRects).toEqual([[999, 8, 1, 7]]);
  });

  it('draws the same ticks when the map is not in pixel order', () => {
    visibleChunks = [0, 1, 2];
    const unsorted = new Map([...TICKS.entries()].reverse());
    render(<StyledTimeScale tickData={tickData(unsorted)} />);

    expect(log.get(0)!.fillRects).toHaveLength(2);
    expect(log.get(1)!.fillRects).toEqual([
      [0, 0, 1, 15],
      [250, 12, 1, 3],
    ]);
    expect(log.get(2)!.fillRects).toEqual([[999, 8, 1, 7]]);
  });

  it('draws only the chunk that scrolled into view', () => {
    visibleChunks = [0, 1];
    const data = tickData(TICKS);
    const { rerender } = render(<StyledTimeScale tickData={data} />);
    expect(clears()).toEqual({ 0: 1, 1: 1 });

    visibleChunks = [1, 2];
    rerender(<StyledTimeScale tickData={data} />);
    expect(clears()).toEqual({ 0: 1, 1: 1, 2: 1 });
  });

  it('does not redraw when only the labels change', () => {
    visibleChunks = [0, 1];
    const { rerender } = render(<StyledTimeScale tickData={tickData(TICKS, 'a')} />);
    rerender(<StyledTimeScale tickData={tickData(TICKS, 'b')} />);

    expect(screen.getByText('b')).toBeDefined();
    expect(clears()).toEqual({ 0: 1, 1: 1 });
  });

  it('redraws when the width changes (resizing a canvas clears it)', () => {
    visibleChunks = [0];
    const { rerender } = render(<StyledTimeScale tickData={tickData(TICKS)} />);
    rerender(<StyledTimeScale tickData={{ ...tickData(TICKS), widthX: 800 }} />);
    expect(clears()).toEqual({ 0: 2 });
  });

  it('redraws when the scale height or the tick colour changes', () => {
    visibleChunks = [0];
    const data = tickData(TICKS);
    const scale = (timeScaleHeight: number, timeColor: string) => (
      <ThemeProvider theme={{ ...defaultTheme, timeColor }}>
        <PlaylistInfoContext.Provider value={{ ...playlistInfoDefaults, timeScaleHeight }}>
          <StyledTimeScale tickData={data} />
        </PlaylistInfoContext.Provider>
      </ThemeProvider>
    );
    const { rerender } = render(scale(15, '#000'));
    rerender(scale(15, '#000'));
    expect(clears()).toEqual({ 0: 1 });

    rerender(scale(30, '#000'));
    expect(clears()).toEqual({ 0: 2 });

    rerender(scale(30, '#fff'));
    expect(clears()).toEqual({ 0: 3 });
  });

  it('redraws when the ticks change', () => {
    visibleChunks = [0];
    const { rerender } = render(<StyledTimeScale tickData={tickData(TICKS)} />);
    rerender(<StyledTimeScale tickData={tickData(new Map(TICKS))} />);
    expect(clears()).toEqual({ 0: 2 });
  });
});

describe('SmartScale', () => {
  // 30 s at the default PlaylistInfo's 48 px per second = 1440 px = two chunks.
  it('does not redraw the ticks when renderTick is a new function', () => {
    visibleChunks = [0, 1];
    const { rerender } = render(
      <SmartScale durationMs={30000} renderTick={(label) => <i>{'one ' + label}</i>} />
    );
    expect(clears()).toEqual({ 0: 1, 1: 1 });
    expect(screen.getByText('one 0:00')).toBeDefined();

    rerender(<SmartScale durationMs={30000} renderTick={(label) => <i>{'two ' + label}</i>} />);
    expect(screen.getByText('two 0:00')).toBeDefined();
    expect(clears()).toEqual({ 0: 1, 1: 1 });
  });

  it('renders default labels and the same ticks without renderTick', () => {
    visibleChunks = [0, 1];
    render(<SmartScale durationMs={30000} />);
    expect(screen.getByText('0:00')).toBeDefined();
    expect(log.get(0)!.fillRects.length).toBeGreaterThan(0);
    expect(log.get(1)!.fillRects.length).toBeGreaterThan(0);
  });

  it('in beats mode, labels bars and keeps the ticks across a new renderTick', () => {
    visibleChunks = [0, 1];
    const scale = (renderTick?: (label: string) => React.ReactNode) => (
      <BeatsAndBarsProvider bpm={120} timeSignature={[4, 4]} snapTo="off">
        <SmartScale durationMs={30000} renderTick={renderTick} />
      </BeatsAndBarsProvider>
    );
    const { rerender } = render(scale());
    // 120 bpm at 48 px per second: a bar is 96 px, so bars are labelled.
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    // Bar lines are full height.
    expect(log.get(0)!.fillRects).toContainEqual([96, 0, 1, 15]);
    expect(clears()).toEqual({ 0: 1, 1: 1 });

    rerender(scale((label) => <i>{'bar ' + label}</i>));
    expect(screen.getByText('bar 2')).toBeDefined();
    expect(clears()).toEqual({ 0: 1, 1: 1 });
  });
});
