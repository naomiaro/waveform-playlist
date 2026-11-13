// @vitest-environment jsdom
//
// #685, step 1: how the root of the multitrack view sorts its children into
// the timescale strip, the controls column and the tracks area, and how the
// tracks part finds the per-clip parts among its children.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect } from 'vitest';
import React from 'react';
import {
  AnnotationBoxesPart,
  ClipHeadersPart,
  FadesPart,
  LoopRegionPart,
  RecordingPreviewPart,
  SelectionPart,
  TimescalePart,
  TrackControlsPart,
  TracksPart,
  scanTracksParts,
  sortWaveformParts,
} from '../components/waveformParts';
import type { VisualizationRecordingState } from '../components/visualizationLayout';

const RECORDING = { isRecording: true, trackId: 't1' } as VisualizationRecordingState;

describe('scanTracksParts', () => {
  it('finds nothing among no children', () => {
    expect(scanTracksParts(undefined)).toEqual({
      showClipHeaders: false,
      showFades: false,
      recordingState: undefined,
    });
  });

  it('finds each per-clip part on its own', () => {
    expect(scanTracksParts(<ClipHeadersPart />)).toMatchObject({
      showClipHeaders: true,
      showFades: false,
    });
    expect(scanTracksParts(<FadesPart />)).toMatchObject({
      showClipHeaders: false,
      showFades: true,
    });
    expect(scanTracksParts(<RecordingPreviewPart recordingState={RECORDING} />)).toEqual({
      showClipHeaders: false,
      showFades: false,
      recordingState: RECORDING,
    });
  });

  it('skips false and null children and looks through fragments', () => {
    const on = false as boolean;
    const found = scanTracksParts(
      <>
        {on ? <ClipHeadersPart /> : null}
        {on && <FadesPart />}
        <>
          <FadesPart />
          <>
            <ClipHeadersPart />
          </>
        </>
      </>
    );
    expect(found).toMatchObject({ showClipHeaders: true, showFades: true });
  });

  it('does not see a part wrapped in another component', () => {
    const Wrapped = () => <ClipHeadersPart />;
    expect(scanTracksParts(<Wrapped />).showClipHeaders).toBe(false);
  });
});

describe('sortWaveformParts', () => {
  it('puts each part in its place and keeps the elements it was given', () => {
    const timescale = <TimescalePart />;
    const loop = <LoopRegionPart />;
    const controls = <TrackControlsPart />;
    const tracks = (
      <TracksPart>
        <ClipHeadersPart />
      </TracksPart>
    );
    const boxes = <AnnotationBoxesPart />;
    const selection = <SelectionPart />;
    const own = <div data-own="" />;

    const sorted = sortWaveformParts([timescale, loop, controls, tracks, boxes, own, selection]);

    expect(sorted.timescale).toEqual([timescale, loop]);
    expect(sorted.timescale[0]).toBe(timescale);
    expect(sorted.controls).toEqual([controls]);
    expect(sorted.controls[0]).toBe(controls);
    // One position per child: the three drawn elsewhere leave a hole each.
    expect(sorted.content).toHaveLength(7);
    expect(sorted.content.slice(0, 3)).toEqual([null, null, null]);
    expect(sorted.content[3]).toBe(tracks);
    expect(sorted.content[4]).toBe(boxes);
    expect(sorted.content[5]).toBe(own);
    expect(sorted.content[6]).toBe(selection);
    expect(sorted.tracksOptions).toMatchObject({ showClipHeaders: true, showFades: false });
  });

  it('a part that is switched off keeps its position, so the parts after it stay mounted', () => {
    const tracks = <TracksPart />;
    const withScale = sortWaveformParts([<TimescalePart key="s" />, tracks]);
    const without = sortWaveformParts([false, tracks]);

    expect(withScale.content.indexOf(tracks)).toBe(1);
    expect(without.content.indexOf(tracks)).toBe(1);
    expect(without.content[0]).toBeNull();
    expect(without.timescale).toEqual([]);
  });

  it('looks through fragments', () => {
    const controls = <TrackControlsPart />;
    const tracks = <TracksPart />;
    const sorted = sortWaveformParts(
      <>
        <>
          {controls}
          {tracks}
        </>
      </>
    );
    expect(sorted.controls[0]).toBe(controls);
    expect(sorted.content).toContain(tracks);
  });

  it('a wrapped part is drawn in the tracks area, and text is kept', () => {
    const Wrapped = () => <TimescalePart />;
    const wrapped = <Wrapped />;
    const sorted = sortWaveformParts([wrapped, 'text']);
    expect(sorted.timescale).toEqual([]);
    expect(sorted.content[0]).toBe(wrapped);
    expect(sorted.content[1]).toBe('text');
  });

  it('with no tracks part, the per-clip options are all off', () => {
    expect(sortWaveformParts(<SelectionPart />).tracksOptions).toEqual({
      showClipHeaders: false,
      showFades: false,
      recordingState: undefined,
    });
  });
});
