// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { StrictMode } from 'react';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';

const fakeBuffer = {
  duration: 2,
  length: 96000,
  sampleRate: 48000,
  numberOfChannels: 1,
} as unknown as AudioBuffer;

vi.mock('@waveform-playlist/playout', () => ({
  getGlobalAudioContext: () => ({
    sampleRate: 48000,
    decodeAudioData: vi.fn().mockResolvedValue(fakeBuffer),
  }),
}));

import { useDynamicTracks } from '../hooks/useDynamicTracks';

const blob = () => new Blob([new Uint8Array(8)]);

describe('useDynamicTracks', () => {
  afterEach(async () => {
    await act(async () => {
      cleanup();
    });
  });

  it('delivers a decoded track', async () => {
    const { result } = renderHook(() => useDynamicTracks());

    act(() => result.current.addTracks([blob()]));
    expect(result.current.tracks).toHaveLength(1);
    expect(result.current.tracks[0].clips).toHaveLength(0);

    await waitFor(() => expect(result.current.tracks[0].clips).toHaveLength(1));
    expect(result.current.loadingCount).toBe(0);
  });

  // StrictMode runs the mount effect, its cleanup, and the effect again on the
  // same instance. The cleanup marked the hook as unmounted and nothing
  // cleared the mark, so every decode that finished afterwards was dropped:
  // placeholders stayed "(loading...)" for good.
  // `wrapper: StrictMode` itself: a function component that returns
  // <StrictMode> does not get the hook's effects double-invoked, and the test
  // then passes without the fix.
  it('delivers a decoded track under StrictMode', async () => {
    const { result } = renderHook(() => useDynamicTracks(), { wrapper: StrictMode });

    act(() => result.current.addTracks([blob()]));

    await waitFor(() => expect(result.current.tracks[0].clips).toHaveLength(1));
    expect(result.current.tracks[0].name).not.toMatch(/loading/);
    expect(result.current.loadingCount).toBe(0);
  });

  it('drops a decode that finishes after unmount', async () => {
    const setStateWarnings = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useDynamicTracks());
    act(() => result.current.addTracks([blob()]));
    const before = result.current.tracks;

    unmount();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(result.current.tracks).toBe(before);
    setStateWarnings.mockRestore();
  });
});
