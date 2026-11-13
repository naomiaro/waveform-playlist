// @vitest-environment jsdom
//
// #770: the four annotation controls have one owner. They are bound to the
// playlist provider here, in the package that draws them, and need no
// <AnnotationProvider>: every case below mounts without one.
import './jsdom-polyfills'; // must be first
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  WaveformPlaylistProvider,
  MediaElementPlaylistProvider,
  useAnnotationOptions,
  useAnnotationIntegration,
} from '@waveform-playlist/browser';
import type { AnnotationData } from '@waveform-playlist/core';
import * as annotationsPackage from '../index';
import {
  ContinuousPlayCheckbox,
  LinkEndpointsCheckbox,
  EditableCheckbox,
  DownloadAnnotationsButton,
  AnnotationProvider,
} from '../index';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const ANNOTATIONS: AnnotationData[] = [
  { id: 'n1', start: 0, end: 1.5, lines: ['one'] },
  { id: 'n2', start: 1.5, end: 3, lines: ['two', 'more'] },
];

// The provider reads the rate and the length from the peak data at mount.
const MEDIA_TRACK = {
  source: 'test.mp3',
  waveformData: { sample_rate: 44100, duration: 3 },
} as never;

type Kind = 'WaveformPlaylistProvider' | 'MediaElementPlaylistProvider';
type ListProp = {
  annotations?: AnnotationData[];
  editable?: boolean;
  linkEndpoints?: boolean;
  isContinuousPlay?: boolean;
};

const fakeAdapter = () =>
  ({
    audioContext: { currentTime: 0, sampleRate: 44100, state: 'running', outputLatency: 0 },
    ppqn: 960,
    async init() {},
    setTracks() {},
    addTrack() {},
    removeTrack() {},
    updateTrack() {},
    play() {},
    pause() {},
    stop() {},
    seek() {},
    getCurrentTime: () => 0,
    isPlaying: () => false,
    setMasterVolume() {},
    setTrackVolume() {},
    setTrackMute() {},
    setTrackSolo() {},
    setTrackPan() {},
    setLoop() {},
    dispose() {},
  }) as never;

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
  }) as never;

let options: ReturnType<typeof useAnnotationOptions>;
const OptionsProbe: React.FC = () => {
  options = useAnnotationOptions();
  return null;
};

const noop = () => {};

async function mount(kind: Kind, children: React.ReactNode, annotationList: ListProp = {}) {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const list = { annotations: ANNOTATIONS, ...annotationList };
  const view = render(
    kind === 'WaveformPlaylistProvider' ? (
      <WaveformPlaylistProvider
        tracks={[]}
        sampleRate={44100}
        createAdapter={fakeAdapter}
        annotationList={list}
        onAnnotationsChange={noop}
      >
        <OptionsProbe />
        {children}
      </WaveformPlaylistProvider>
    ) : (
      <MediaElementPlaylistProvider
        track={MEDIA_TRACK}
        createPlayout={fakePlayout}
        annotationList={list}
        onAnnotationsChange={noop}
      >
        <OptionsProbe />
        {children}
      </MediaElementPlaylistProvider>
    )
  );
  await act(async () => {});
  return view;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe.each<Kind>(['WaveformPlaylistProvider', 'MediaElementPlaylistProvider'])(
  'the annotation controls under %s, without <AnnotationProvider> (#770)',
  (kind) => {
    it('the three checkboxes show the provider options and set them', async () => {
      const { getByLabelText } = await mount(
        kind,
        <>
          <ContinuousPlayCheckbox />
          <LinkEndpointsCheckbox />
          <EditableCheckbox />
        </>,
        { linkEndpoints: true }
      );
      const boxes = ['Continuous Play', 'Link Endpoints', 'Editable Annotations'].map(
        (label) => getByLabelText(label) as HTMLInputElement
      );
      expect(boxes.map((box) => box.checked)).toEqual([false, true, false]);
      boxes.forEach((box) => fireEvent.click(box));
      expect(options).toEqual({ continuousPlay: true, linkEndpoints: false, editable: true });
      expect(boxes.map((box) => box.checked)).toEqual([true, false, true]);
    });

    it('children replace the label; className goes on the wrapper; the input classes stay', async () => {
      const { getByLabelText, queryByText, container } = await mount(
        kind,
        <>
          <ContinuousPlayCheckbox className="mine">Sans arrêt</ContinuousPlayCheckbox>
          <LinkEndpointsCheckbox>Lier</LinkEndpointsCheckbox>
          <EditableCheckbox>Modifiable</EditableCheckbox>
        </>
      );
      expect(queryByText('Continuous Play')).toBeNull();
      const continuous = getByLabelText('Sans arrêt') as HTMLInputElement;
      expect(continuous.className).toContain('continuous-play');
      expect(container.querySelector('.mine')?.contains(continuous)).toBe(true);
      expect(getByLabelText('Lier').className).toContain('link-endpoints');
      fireEvent.click(getByLabelText('Modifiable'));
      expect(options.editable).toBe(true);
    });

    it('two of one checkbox do not share an id', async () => {
      const { container } = await mount(
        kind,
        <>
          <EditableCheckbox />
          <EditableCheckbox />
        </>
      );
      const ids = [...container.querySelectorAll('input')].map((input) => input.id);
      expect(ids).toHaveLength(2);
      expect(ids[0]).not.toBe('');
      expect(new Set(ids).size).toBe(2);
    });

    it('the download button saves the provider annotations as Aeneas fragments', async () => {
      const blobs: Blob[] = [];
      const createObjectURL = vi.fn((blob: Blob) => {
        blobs.push(blob);
        return 'blob:test';
      });
      const revokeObjectURL = vi.fn();
      Object.assign(URL, { createObjectURL, revokeObjectURL });
      const downloads: string[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement
      ) {
        downloads.push(this.download);
      });
      const { getByRole } = await mount(
        kind,
        <DownloadAnnotationsButton filename="mine.json" className="dl" />
      );
      const button = getByRole('button', { name: 'Download JSON' }) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
      expect(button.title).toBe('Download the annotations as JSON');
      expect(button.className).toContain('dl');
      fireEvent.click(button);
      expect(downloads).toEqual(['mine.json']);
      expect(blobs).toHaveLength(1);
      expect(blobs[0].type).toBe('application/json');
      expect(JSON.parse(await blobs[0].text())).toEqual([
        { id: 'n1', begin: '0.000', end: '1.500', lines: ['one'], language: 'en' },
        { id: 'n2', begin: '1.500', end: '3.000', lines: ['two', 'more'], language: 'en' },
      ]);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
    });

    it('the download button: default filename, children as the label, disabled', async () => {
      const downloads: string[] = [];
      Object.assign(URL, { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} });
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement
      ) {
        downloads.push(this.download);
      });
      const { getByRole } = await mount(
        kind,
        <>
          <DownloadAnnotationsButton>Enregistrer</DownloadAnnotationsButton>
          <DownloadAnnotationsButton disabled>Off</DownloadAnnotationsButton>
        </>
      );
      fireEvent.click(getByRole('button', { name: 'Enregistrer' }));
      expect(downloads).toEqual(['annotations.json']);
      const off = getByRole('button', { name: 'Off' }) as HTMLButtonElement;
      expect(off.disabled).toBe(true);
      fireEvent.click(off);
      expect(downloads).toEqual(['annotations.json']);
    });

    it('the download button is disabled, and says why, without annotations', async () => {
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      const { getByRole } = await mount(kind, <DownloadAnnotationsButton />, { annotations: [] });
      const button = getByRole('button', { name: 'Download JSON' }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.title).toBe('No annotations to download');
      fireEvent.click(button);
      expect(click).not.toHaveBeenCalled();
    });

    it('the download button: `title` replaces the tooltip, with and without annotations', async () => {
      const first = await mount(kind, <DownloadAnnotationsButton title="Télécharger" />);
      expect((first.getByRole('button') as HTMLButtonElement).title).toBe('Télécharger');
      first.unmount();
      const second = await mount(kind, <DownloadAnnotationsButton title="Télécharger" />, {
        annotations: [],
      });
      expect((second.getByRole('button') as HTMLButtonElement).title).toBe('Télécharger');
    });
  }
);

describe('a control written for the controlled form these names had before (#770)', () => {
  // The names stayed and their props changed, so such code still imports.
  const Old = ContinuousPlayCheckbox as unknown as React.FC<{
    checked: boolean;
    onChange: (checked: boolean) => void;
  }>;

  it('under a provider: its `checked` and `onChange` are ignored, the provider option is used', async () => {
    const onChange = vi.fn();
    const { getByLabelText } = await mount(
      'WaveformPlaylistProvider',
      <Old checked onChange={onChange} />
    );
    const box = getByLabelText('Continuous Play') as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(onChange).not.toHaveBeenCalled();
    expect(options.continuousPlay).toBe(true);
  });

  it('without a playlist provider: throws the provider hook message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Old checked onChange={() => {}} />)).toThrow(
      /WaveformPlaylistProvider or MediaElementPlaylistProvider/
    );
    expect(() => render(<DownloadAnnotationsButton />)).toThrow(
      /WaveformPlaylistProvider or MediaElementPlaylistProvider/
    );
  });
});

describe('what the package exports (#770)', () => {
  it('has the bound controls and none of the removed names', () => {
    const names = Object.keys(annotationsPackage);
    expect(names).toEqual(
      expect.arrayContaining([
        'ContinuousPlayCheckbox',
        'LinkEndpointsCheckbox',
        'EditableCheckbox',
        'DownloadAnnotationsButton',
        'AnnotationBox',
        'AnnotationBoxesWrapper',
        'AnnotationText',
        'AnnotationProvider',
        'parseAeneas',
        'serializeAeneas',
      ])
    );
    for (const removed of ['Annotation', 'AnnotationsTrack', 'useAnnotationControls']) {
      expect(names).not.toContain(removed);
    }
  });

  it('<AnnotationProvider> hands browser only what its own views draw', () => {
    let keys: string[] = [];
    const Probe: React.FC = () => {
      keys = Object.keys(useAnnotationIntegration()).sort();
      return null;
    };
    render(
      <AnnotationProvider>
        <Probe />
      </AnnotationProvider>
    );
    expect(keys).toEqual([
      'AnnotationBox',
      'AnnotationBoxesWrapper',
      'AnnotationText',
      'parseAeneas',
      'serializeAeneas',
    ]);
  });
});
