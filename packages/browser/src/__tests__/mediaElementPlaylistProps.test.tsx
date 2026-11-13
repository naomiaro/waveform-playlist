// @vitest-environment jsdom
//
// #685: the MediaElement view is a composition (the view here is
// `ComposedMediaElementWaveform`, testCompositions.tsx). Since #686 the
// annotation-boxes part is `WaveformAnnotationBoxes` under both providers: the
// label function reaches it as a prop (`getLabel`), and `editable` and
// `linkEndpoints` are no props of any part: they are the provider's options,
// given through its `annotationList` prop.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';
import type { MediaElementPlayout } from '@waveform-playlist/media-element-playout';
import type { WaveformDataObject } from '@waveform-playlist/core';
import type { WaveformAnnotationBoxesProps } from '../components/WaveformAnnotationBoxes';

const seen = vi.hoisted(() => ({ props: [] as unknown[] }));

vi.mock('../components/WaveformAnnotationBoxes', () => ({
  WaveformAnnotationBoxes: (props: unknown) => {
    seen.props.push(props);
    return null;
  },
}));

import { MediaElementPlaylistProvider } from '../MediaElementPlaylistContext';
import { useAnnotationOptions } from '../contexts/playlistContexts';
import type { AnnotationListProp } from '../providerInternals/useAnnotationState';
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

const lastProps = () => seen.props[seen.props.length - 1] as WaveformAnnotationBoxesProps;

let options: ReturnType<typeof useAnnotationOptions>;
const OptionsProbe: React.FC = () => {
  options = useAnnotationOptions();
  return null;
};

function mount(playlist: React.ReactElement, annotationList?: AnnotationListProp) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  seen.props = [];
  render(
    <MediaElementPlaylistProvider
      track={{ source: 'x.mp3', waveformData: WAVEFORM_DATA }}
      samplesPerPixel={882}
      createPlayout={fakePlayout}
      annotationList={annotationList}
    >
      <OptionsProbe />
      {playlist}
    </MediaElementPlaylistProvider>
  );
}

describe('the annotation options reach the MediaElement boxes', () => {
  it('the label function as given, as a prop of the part; editable and linkEndpoints through the provider', () => {
    const label = () => 'x';
    mount(<ComposedMediaElementWaveform getLabel={label} />, {
      editable: true,
      linkEndpoints: true,
    });
    expect(lastProps()).toEqual({ getLabel: label });
    expect(options.editable).toBe(true);
    expect(options.linkEndpoints).toBe(true);
  });

  it('editable and linkEndpoints are false when left out', () => {
    mount(<ComposedMediaElementWaveform />);
    expect(lastProps()).toEqual({ getLabel: undefined });
    expect(options.editable).toBe(false);
    expect(options.linkEndpoints).toBe(false);
  });
});
