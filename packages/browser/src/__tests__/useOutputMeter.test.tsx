// @vitest-environment jsdom
//
// #695: output levels change ~60 times a second. The hook publishes them
// through a `MeterSource` and must not re-render its component for them.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

interface MockNode {
  port: { onmessage: ((event: MessageEvent) => void) | null; close: () => void };
  onprocessorerror: ((event: Event) => void) | null;
  disconnect: () => void;
}

let meterNode: MockNode;
let mockContext: {
  rawContext: { audioWorklet: { addModule: ReturnType<typeof vi.fn> } };
  createAudioWorkletNode: ReturnType<typeof vi.fn>;
  destination: { chain: ReturnType<typeof vi.fn> };
};

vi.mock('@waveform-playlist/playout', () => ({
  getGlobalContext: () => mockContext,
}));

vi.mock('@waveform-playlist/worklets', () => ({
  meterProcessorUrl: 'meter-processor.js',
}));

// vi.mock calls are hoisted above this import.
import { useOutputMeter } from '../hooks/useOutputMeter';

beforeEach(() => {
  meterNode = {
    port: { onmessage: null, close: vi.fn() },
    onprocessorerror: null,
    disconnect: vi.fn(),
  };
  mockContext = {
    rawContext: { audioWorklet: { addModule: vi.fn(() => Promise.resolve()) } },
    createAudioWorkletNode: vi.fn(() => meterNode),
    destination: { chain: vi.fn() },
  };
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

function post(data: number[]) {
  meterNode.port.onmessage!({ data: new Float32Array(data) } as MessageEvent);
}

describe('useOutputMeter', () => {
  it('starts silent with one entry per channel', () => {
    const { result } = renderHook(() => useOutputMeter({ channelCount: 2, isPlaying: true }));
    expect(result.current.meter.getSnapshot()).toEqual({
      levels: [0, 0],
      peakLevels: [0, 0],
      rmsLevels: [0, 0],
    });
    expect(Object.keys(result.current).sort()).toEqual(['error', 'meter', 'resetPeak']);
  });

  it('publishes levels through a stable source without re-rendering', async () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useOutputMeter({ channelCount: 2, isPlaying: true });
    });
    await act(async () => {});
    const meter = result.current.meter;
    const listener = vi.fn();
    meter.subscribe(listener);
    const rendersBefore = renders;

    act(() => {
      post([0.5, 0.25, 0.1, 0.05]);
      post([0.4, 0.2, 0.1, 0.05]);
    });

    expect(listener).toHaveBeenCalledTimes(2);
    const snapshot = meter.getSnapshot();
    expect(snapshot.levels).toHaveLength(2);
    expect(snapshot.levels[0]).toBeGreaterThan(snapshot.levels[1]);
    expect(snapshot.rmsLevels[0]).toBeGreaterThan(0);
    expect(renders).toBe(rendersBefore);
    expect(result.current.meter).toBe(meter);
  });

  it('holds the peak until resetPeak', async () => {
    const { result } = renderHook(() => useOutputMeter({ channelCount: 1, isPlaying: true }));
    await act(async () => {});
    const meter = result.current.meter;

    act(() => post([1, 0.5]));
    const loud = meter.getSnapshot().peakLevels[0];
    act(() => post([0, 0]));
    expect(meter.getSnapshot().peakLevels[0]).toBe(loud);

    act(() => result.current.resetPeak());

    expect(meter.getSnapshot().peakLevels).toEqual([0]);
    expect(meter.getSnapshot().levels[0]).toBeGreaterThan(0);
  });

  it('goes silent when playback stops', async () => {
    const { result, rerender } = renderHook(
      ({ isPlaying }: { isPlaying: boolean }) => useOutputMeter({ channelCount: 2, isPlaying }),
      { initialProps: { isPlaying: true } }
    );
    await act(async () => {});
    const meter = result.current.meter;
    act(() => post([1, 1, 0.5, 0.5]));
    expect(meter.getSnapshot().levels[0]).toBeGreaterThan(0);

    rerender({ isPlaying: false });

    expect(meter.getSnapshot()).toEqual({
      levels: [0, 0],
      peakLevels: [0, 0],
      rmsLevels: [0, 0],
    });
    // The smoothed peak was reset too: a quiet reading is not lifted by the
    // decaying tail of the loud one before the stop.
    rerender({ isPlaying: true });
    act(() => post([0.001, 0.001, 0, 0]));
    expect(meter.getSnapshot().levels[0]).toBeLessThan(0.5);
  });

  it('surfaces a setup error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockContext.rawContext.audioWorklet.addModule.mockRejectedValueOnce(new Error('CSP blocked'));
    const { result } = renderHook(() => useOutputMeter());
    await act(async () => {});
    expect(result.current.error?.message).toBe('CSP blocked');
  });
});
