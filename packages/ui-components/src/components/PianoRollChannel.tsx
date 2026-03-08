import React, { FunctionComponent, useLayoutEffect, useMemo } from 'react';
import styled from 'styled-components';
import type { MidiNoteData } from '@waveform-playlist/core';
import { MAX_CANVAS_WIDTH } from '@waveform-playlist/core';
import { useVisibleChunkIndices } from '../contexts/ScrollViewport';
import { useClipViewportOrigin } from '../contexts/ClipViewportOrigin';
import { useChunkedCanvasRefs } from '../hooks/useChunkedCanvasRefs';

interface CanvasProps {
  readonly $cssWidth: number;
  readonly $waveHeight: number;
  readonly $left: number;
}

const NoteCanvas = styled.canvas.attrs<CanvasProps>((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    height: `${props.$waveHeight}px`,
    left: `${props.$left}px`,
  },
}))<CanvasProps>`
  position: absolute;
  top: 0;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
`;

interface WrapperProps {
  readonly $index: number;
  readonly $cssWidth: number;
  readonly $waveHeight: number;
  readonly $backgroundColor: string;
}

const Wrapper = styled.div.attrs<WrapperProps>((props) => ({
  style: {
    top: `${props.$waveHeight * props.$index}px`,
    width: `${props.$cssWidth}px`,
    height: `${props.$waveHeight}px`,
  },
}))<WrapperProps>`
  position: absolute;
  background: ${(props) => props.$backgroundColor};
  transform: translateZ(0);
  backface-visibility: hidden;
`;

export interface PianoRollChannelProps {
  index: number;
  midiNotes: MidiNoteData[];
  length: number;
  waveHeight: number;
  devicePixelRatio: number;
  samplesPerPixel: number;
  sampleRate: number;
  clipOffsetSeconds: number;
  noteColor?: string;
  selectedNoteColor?: string;
  isSelected?: boolean;
  transparentBackground?: boolean;
  backgroundColor?: string;
}

export const PianoRollChannel: FunctionComponent<PianoRollChannelProps> = ({
  index,
  midiNotes,
  length,
  waveHeight,
  devicePixelRatio,
  samplesPerPixel,
  sampleRate,
  clipOffsetSeconds,
  noteColor = '#2a7070',
  selectedNoteColor = '#3d9e9e',
  isSelected = false,
  transparentBackground = false,
  backgroundColor = '#1a1a2e',
}) => {
  const { canvasRef, canvasMapRef } = useChunkedCanvasRefs();
  const clipOriginX = useClipViewportOrigin();
  const visibleChunkIndices = useVisibleChunkIndices(length, MAX_CANVAS_WIDTH, clipOriginX);

  // Compute note pitch range for vertical mapping
  const { minMidi, maxMidi } = useMemo(() => {
    if (midiNotes.length === 0) return { minMidi: 0, maxMidi: 127 };
    let min = 127,
      max = 0;
    for (const note of midiNotes) {
      if (note.midi < min) min = note.midi;
      if (note.midi > max) max = note.midi;
    }
    // Add 1-note padding on each side for visual breathing room
    return { minMidi: Math.max(0, min - 1), maxMidi: Math.min(127, max + 1) };
  }, [midiNotes]);

  const color = isSelected ? selectedNoteColor : noteColor;

  // useLayoutEffect so canvas drawing completes before the browser paints —
  // prevents flicker from clearRect being visible for one frame.
  useLayoutEffect(() => {
    const noteRange = maxMidi - minMidi + 1;
    const noteHeight = Math.max(2, waveHeight / noteRange);
    const pixelsPerSecond = sampleRate / samplesPerPixel;

    for (const [canvasIdx, canvas] of canvasMapRef.current.entries()) {
      const chunkPixelStart = canvasIdx * MAX_CANVAS_WIDTH;
      const canvasWidth = canvas.width / devicePixelRatio;

      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      ctx.resetTransform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.scale(devicePixelRatio, devicePixelRatio);

      // Time range this chunk covers (relative to clip start)
      const chunkStartTime = (chunkPixelStart * samplesPerPixel) / sampleRate;
      const chunkEndTime = ((chunkPixelStart + canvasWidth) * samplesPerPixel) / sampleRate;

      for (const note of midiNotes) {
        // Note times are relative to clip start; clipOffsetSeconds shifts them
        const noteStart = note.time - clipOffsetSeconds;
        const noteEnd = noteStart + note.duration;

        // Skip notes outside this chunk's time range
        if (noteEnd <= chunkStartTime || noteStart >= chunkEndTime) continue;

        const x = noteStart * pixelsPerSecond - chunkPixelStart;
        const w = Math.max(2, note.duration * pixelsPerSecond);
        // MIDI note 127 is at top (y=0), note 0 at bottom
        const y = ((maxMidi - note.midi) / noteRange) * waveHeight;

        // Velocity maps to opacity: 0.3 (pp) → 1.0 (ff)
        const alpha = 0.3 + note.velocity * 0.7;
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;

        // Rounded rectangle (1px radius)
        const r = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, w, noteHeight, r);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    }
  }, [
    canvasMapRef,
    midiNotes,
    waveHeight,
    devicePixelRatio,
    samplesPerPixel,
    sampleRate,
    clipOffsetSeconds,
    color,
    minMidi,
    maxMidi,
    length,
    visibleChunkIndices,
    index,
  ]);

  const canvases = visibleChunkIndices.map((i) => {
    const chunkLeft = i * MAX_CANVAS_WIDTH;
    const currentWidth = Math.min(length - chunkLeft, MAX_CANVAS_WIDTH);

    return (
      <NoteCanvas
        key={`${length}-${i}`}
        $cssWidth={currentWidth}
        $left={chunkLeft}
        width={currentWidth * devicePixelRatio}
        height={waveHeight * devicePixelRatio}
        $waveHeight={waveHeight}
        data-index={i}
        ref={canvasRef}
      />
    );
  });

  const bgColor = transparentBackground ? 'transparent' : backgroundColor;

  return (
    <Wrapper $index={index} $cssWidth={length} $waveHeight={waveHeight} $backgroundColor={bgColor}>
      {canvases}
    </Wrapper>
  );
};
