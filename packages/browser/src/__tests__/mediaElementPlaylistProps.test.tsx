// @vitest-environment jsdom
//
// #685: the MediaElement view is a composition. The four annotation options
// must reach the annotation-boxes part as they were given (the view here is
// `ComposedMediaElementWaveform`, testCompositions.tsx).
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';
import type { MediaElementPlayout } from '@waveform-playlist/media-element-playout';
import type { WaveformDataObject } from '@waveform-playlist/core';
import type { MediaElementAnnotationBoxesProps } from '../components/MediaElementAnnotationBoxes';

const seen = vi.hoisted(() => ({ props: [] as unknown[] }));

vi.mock('../components/MediaElementAnnotationBoxes', () => ({
  MediaElementAnnotationBoxes: (props: unknown) => {
    seen.props.push(props);
    return null;
  },
}));

import { MediaElementPlaylistProvider } from '../MediaElementPlaylistContext';
import { ComposedMediaElementWaveform } from './testCompositions';

const WAVEFORM_DATA = WaveformData.create({
  version: 2,
  channels: 1,
  sample_rate: 44100,
  samples_per_pixel: 441,
  bits: 8,
  length: 200,
  data: Array.from({ length: 400 }, (_, i) => (i % 2 === 0 ? -10 : 10)),
}) as unknown as WaveformDataObject;

const fakePlayout = () =>
  ({
    addTrack() {},
    getTrack: () => undefined,
    setOnPlaybackComplete() {},
    on() {},
    off() {},
    play() {},
    pause() {},
    stop() {},
    seekTo() {},
    setPlaybackRate() {},
    getCurrentTime: () => 0,
    dispose() {},
  }) as unknown as MediaElementPlayout;

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

const lastProps = () => seen.props[seen.props.length - 1] as MediaElementAnnotationBoxesProps;

function mount(playlist: React.ReactElement) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  seen.props = [];
  render(
    <MediaElementPlaylistProvider
      track={{ source: 'x.mp3', waveformData: WAVEFORM_DATA }}
      samplesPerPixel={882}
      createPlayout={fakePlayout}
    >
      {playlist}
    </MediaElementPlaylistProvider>
  );
}

describe('the annotation options reach the MediaElement boxes', () => {
  it('as given', () => {
    const label = () => 'x';
    const onUpdate = () => {};
    mount(
      <ComposedMediaElementWaveform
        getAnnotationBoxLabel={label}
        editable
        linkEndpoints
        onAnnotationUpdate={onUpdate}
      />
    );
    expect(lastProps()).toEqual({
      getAnnotationBoxLabel: label,
      editable: true,
      linkEndpoints: true,
      onAnnotationUpdate: onUpdate,
    });
  });

  it('editable and linkEndpoints are false when left out', () => {
    mount(<ComposedMediaElementWaveform />);
    expect(lastProps()).toEqual({
      getAnnotationBoxLabel: undefined,
      editable: false,
      linkEndpoints: false,
      onAnnotationUpdate: undefined,
    });
  });
});
