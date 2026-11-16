// @vitest-environment jsdom
//
// #812: a clip whose audio is not loaded yet is drawn as a placeholder and
// nothing may edit it: no trim handles, and its header does not start a drag.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { render, cleanup } from '@testing-library/react';
import { DragDropProvider } from '@dnd-kit/react';
import { Clip, defaultTheme } from '@waveform-playlist/ui-components';

// The tracks part reads these from the providers; the test supplies them.
vi.mock('../contexts/playlistContexts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../contexts/playlistContexts')>()),
  useEngineRefs: () => ({}),
  usePlaylistView: () => ({ sampleRate: 48000, mono: false }),
  usePlaylistZoom: () => ({ samplesPerPixel: 500 }),
  useSelectedRow: () => ({ selectedTrackId: null }),
}));

// The channel's progress overlay needs the playback contexts; it is not under test.
// It draws a marker here so a test can count the channels of a clip.
vi.mock('../components/ChannelWithProgress', async () => {
  const { createElement } = await import('react');
  return { ChannelWithProgress: () => createElement('div', { 'data-test-channel': '' }) };
});

import { WaveformTracks, WaveformClipHeaders } from '../components/TrackRows';
import { WaveformExtentContext, WaveformRowsContext } from '../components/waveformLayoutContext';
import type { WaveformRowsValue } from '../components/waveformLayoutContext';
import { ClipInteractionOptions } from '../contexts/ClipInteractionContext';
import type { ClipPeaks } from '../WaveformPlaylistContext';

afterEach(cleanup);

function row(isPlaceholder: boolean) {
  return render(
    <DragDropProvider>
      <Clip
        clipId="c1"
        trackIndex={0}
        clipIndex={0}
        trackName="Vocals"
        startSample={0}
        durationSamples={48000}
        samplesPerPixel={500}
        showHeader
        isPlaceholder={isPlaceholder}
      />
    </DragDropProvider>
  );
}

describe('a placeholder row', () => {
  it('a placeholder row has no trim handles and its header does not start a drag', () => {
    const { container } = row(true);
    expect(container.querySelectorAll('[data-boundary-edge]')).toHaveLength(0);
    expect(container.querySelector('[data-clip-id]')).toBeNull();
    expect(
      container.querySelector('[data-clip-container]')?.getAttribute('data-clip-placeholder')
    ).toBe('true');
  });

  it('a loaded clip has both handles and a header that drags (the control)', () => {
    const { container } = row(false);
    expect(container.querySelectorAll('[data-boundary-edge]')).toHaveLength(2);
    expect(container.querySelector('[data-clip-id="c1"]')).not.toBeNull();
    expect(container.querySelector('[data-clip-placeholder]')).toBeNull();
  });
});

// The real tracks part, fed the rows a root would give it (the layout contexts)
// with a placeholder record next to a loaded one in the same row.
describe('the tracks part draws a placeholder record as a placeholder', () => {
  it('a placeholder clip of a row has the attribute, no trim handles and no draggable header; the loaded clip beside it has them', () => {
    const peaks = { length: 0, data: [new Int16Array(0)], bits: 16 as const };
    const record = (clipId: string, startSample: number, isPlaceholder: boolean): ClipPeaks => ({
      clipId,
      trackName: 'Vocals',
      peaks,
      startSample,
      durationSamples: 48000,
      isPlaceholder,
    });
    const rows: WaveformRowsValue = {
      rows: [{ id: 't1', kind: 'audio' }],
      peaksDataArray: [[record('loaded', 0, false), record('loading', 96000, true)]],
      showClipHeaders: true,
      trackHeightById: new Map([['t1', 120]]),
      trackLayout: { topById: new Map([['t1', 0]]), totalHeight: 120 },
      animateTrackLayout: false,
      renderModeById: new Map(),
      spectrogramHelpersById: new Map(),
      selectTrack: () => {},
      setSettingsModalTrackId: () => {},
      recordingChannelCount: 0,
      dragSourceTrackId: null,
    };
    const { container } = render(
      <ThemeProvider theme={defaultTheme}>
        <DragDropProvider>
          <ClipInteractionOptions enabled>
            <WaveformExtentContext value={{ displayDuration: 4, tracksFullWidth: 400 }}>
              <WaveformRowsContext value={rows}>
                <WaveformTracks>
                  <WaveformClipHeaders />
                </WaveformTracks>
              </WaveformRowsContext>
            </WaveformExtentContext>
          </ClipInteractionOptions>
        </DragDropProvider>
      </ThemeProvider>
    );
    const containers = [...container.querySelectorAll('[data-clip-container]')];
    expect(containers).toHaveLength(2);
    const [loaded, loading] = containers;
    expect(loaded.hasAttribute('data-clip-placeholder')).toBe(false);
    expect(loaded.querySelectorAll('[data-boundary-edge]')).toHaveLength(2);
    expect(loaded.querySelector('[data-clip-id="loaded"]')).not.toBeNull();
    expect(loading.getAttribute('data-clip-placeholder')).toBe('true');
    expect(loading.querySelectorAll('[data-boundary-edge]')).toHaveLength(0);
    expect(loading.querySelector('[data-clip-id]')).toBeNull();
  });
});

// The body of a placeholder without peaks (#812): drawn by the row for a
// placeholder record whose peaks are empty, and for no other record.
describe('a placeholder without peaks draws its body', () => {
  const EMPTY = { length: 0, data: [new Int16Array(0)], bits: 16 as const };
  const DRAWN = { length: 10, data: [new Int16Array(20)], bits: 16 as const };
  const record = (
    clipId: string,
    startSample: number,
    isPlaceholder: boolean,
    peaks: ClipPeaks['peaks']
  ): ClipPeaks => ({
    clipId,
    trackName: 'Vocals',
    peaks,
    startSample,
    durationSamples: 48000,
    isPlaceholder,
  });

  function renderRow(showClipHeaders: boolean) {
    const rows: WaveformRowsValue = {
      rows: [{ id: 't1', kind: 'audio' }],
      peaksDataArray: [
        [
          // The loaded clip has empty peaks too, so only `isPlaceholder` tells
          // it from the placeholder without peaks.
          record('loaded', 0, false, EMPTY),
          record('loading-empty', 96000, true, EMPTY),
          record('loading-peaks', 192000, true, DRAWN),
        ],
      ],
      showClipHeaders,
      trackHeightById: new Map([['t1', 120]]),
      trackLayout: { topById: new Map([['t1', 0]]), totalHeight: 120 },
      animateTrackLayout: false,
      renderModeById: new Map(),
      spectrogramHelpersById: new Map(),
      selectTrack: () => {},
      setSettingsModalTrackId: () => {},
      recordingChannelCount: 0,
      dragSourceTrackId: null,
    };
    const { container } = render(
      <ThemeProvider theme={defaultTheme}>
        <DragDropProvider>
          <ClipInteractionOptions enabled>
            <WaveformExtentContext value={{ displayDuration: 6, tracksFullWidth: 600 }}>
              <WaveformRowsContext value={rows}>
                <WaveformTracks>{showClipHeaders ? <WaveformClipHeaders /> : null}</WaveformTracks>
              </WaveformRowsContext>
            </WaveformExtentContext>
          </ClipInteractionOptions>
        </DragDropProvider>
      </ThemeProvider>
    );
    const [loaded, loadingEmpty, loadingPeaks] = [
      ...container.querySelectorAll<HTMLElement>('[data-clip-container]'),
    ];
    return { loaded, loadingEmpty, loadingPeaks };
  }

  const bodiesOf = (clip: HTMLElement) => clip.querySelectorAll('[data-clip-placeholder-body]');
  const channelsOf = (clip: HTMLElement) => clip.querySelectorAll('[data-test-channel]');

  it('a placeholder without peaks draws a body of the clip width and the channel area height', () => {
    const { loadingEmpty } = renderRow(true);
    expect(loadingEmpty.getAttribute('data-clip-placeholder')).toBe('true');
    expect(bodiesOf(loadingEmpty)).toHaveLength(1);
    // In the channels' wrapper (the clip's second child, below its header),
    // which the body fills (ui-components' clipPlaceholderBody.test.tsx).
    const body = bodiesOf(loadingEmpty)[0];
    expect(body.parentElement).toBe(loadingEmpty.children[1]);
    expect(loadingEmpty.style.width).toBe(`${48000 / 500}px`);
  });

  it('a placeholder with peaks draws its waveform and no body box', () => {
    const { loadingPeaks } = renderRow(true);
    expect(loadingPeaks.getAttribute('data-clip-placeholder')).toBe('true');
    expect(bodiesOf(loadingPeaks)).toHaveLength(0);
    expect(channelsOf(loadingPeaks)).toHaveLength(1);
  });

  it('a loaded clip is unchanged: no body; its header, its channels and its two trim handles only', () => {
    const { loaded } = renderRow(true);
    expect(bodiesOf(loaded)).toHaveLength(0);
    expect(loaded.children).toHaveLength(4);
    expect(loaded.querySelectorAll(':scope > [data-boundary-edge]')).toHaveLength(2);
    expect(loaded.querySelector('[data-clip-id="loaded"]')).not.toBeNull();
    const wrapper = loaded.children[1];
    expect([...wrapper.children].every((el) => el.hasAttribute('data-test-channel'))).toBe(true);
    expect(channelsOf(loaded)).toHaveLength(1);
  });

  it('the body is drawn without clip headers too', () => {
    const { loaded, loadingEmpty, loadingPeaks } = renderRow(false);
    expect(loadingEmpty.textContent).toBe('');
    expect(loadingEmpty.children).toHaveLength(1);
    expect(bodiesOf(loadingEmpty)).toHaveLength(1);
    expect(bodiesOf(loadingPeaks)).toHaveLength(0);
    expect(bodiesOf(loaded)).toHaveLength(0);
  });
});
