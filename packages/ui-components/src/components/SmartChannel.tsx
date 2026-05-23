import React, { FunctionComponent } from 'react';
import { useDevicePixelRatio, usePlaylistInfo, useTheme } from '../contexts';
import { Channel } from './Channel';
import { PianoRollChannel } from './PianoRollChannel';
import { SpectrogramChannel, type SpectrogramCanvasRegistration } from './SpectrogramChannel';
import type { RenderMode, MidiNoteData } from '@waveform-playlist/core';

export interface SmartChannelProps {
  className?: string;
  index: number;
  data: Int8Array | Int16Array;
  bits: 8 | 16;
  length: number;
  isSelected?: boolean; // Whether this channel's track is selected
  /** If true, background is transparent (for use with external progress overlay) */
  transparentBackground?: boolean;
  /** Render mode: waveform, spectrogram, or both */
  renderMode?: RenderMode;
  /** Samples per pixel at current zoom level */
  samplesPerPixel?: number;
  /** Clip ID for spectrogram canvas registration */
  spectrogramClipId?: string;
  /** Single-call registration for spectrogram canvases (from SpectrogramIntegration). */
  spectrogramOnCanvasRegister?: (reg: SpectrogramCanvasRegistration) => void;
  /** Counterpart for chunk unmount / unmount. */
  spectrogramOnCanvasUnregister?: (canvasId: string) => void;
  /** MIDI note data for piano-roll rendering */
  midiNotes?: MidiNoteData[];
  /** Sample rate for MIDI note time → pixel conversion */
  sampleRate?: number;
  /** Clip offset in seconds for MIDI note positioning */
  clipOffsetSeconds?: number;
}

export const SmartChannel: FunctionComponent<SmartChannelProps> = ({
  isSelected,
  transparentBackground,
  renderMode = 'waveform',
  samplesPerPixel: sppProp,
  spectrogramClipId,
  spectrogramOnCanvasRegister,
  spectrogramOnCanvasUnregister,
  midiNotes,
  sampleRate: sampleRateProp,
  clipOffsetSeconds,
  ...props
}) => {
  const theme = useTheme();
  const {
    waveHeight,
    barWidth,
    barGap,
    samplesPerPixel: contextSpp,
    sampleRate: contextSampleRate,
  } = usePlaylistInfo();
  const devicePixelRatio = useDevicePixelRatio();
  const samplesPerPixel = sppProp ?? contextSpp;

  // Use selected colors if track is selected
  const waveOutlineColor =
    isSelected && theme ? theme.selectedWaveOutlineColor : theme?.waveOutlineColor;

  const waveFillColor = isSelected && theme ? theme.selectedWaveFillColor : theme?.waveFillColor;

  // Get draw mode from theme (defaults to 'inverted' for backwards compatibility)
  const drawMode = theme?.waveformDrawMode || 'inverted';

  // Spectrogram requires registration callbacks and a clip ID.
  const hasSpectrogram =
    spectrogramClipId && spectrogramOnCanvasRegister && spectrogramOnCanvasUnregister;

  if (renderMode === 'spectrogram' && hasSpectrogram) {
    return (
      <SpectrogramChannel
        index={props.index}
        length={props.length}
        waveHeight={waveHeight}
        devicePixelRatio={devicePixelRatio}
        samplesPerPixel={samplesPerPixel}
        clipId={spectrogramClipId}
        onCanvasRegister={spectrogramOnCanvasRegister}
        onCanvasUnregister={spectrogramOnCanvasUnregister}
      />
    );
  }

  if (renderMode === 'both' && hasSpectrogram) {
    // Spectrogram above, waveform below — each at half waveHeight so the
    // overall track container stays the same height as a single-mode track.
    const halfHeight = Math.floor(waveHeight / 2);
    return (
      <>
        <SpectrogramChannel
          index={props.index * 2}
          channelIndex={props.index}
          length={props.length}
          waveHeight={halfHeight}
          devicePixelRatio={devicePixelRatio}
          samplesPerPixel={samplesPerPixel}
          clipId={spectrogramClipId}
          onCanvasRegister={spectrogramOnCanvasRegister}
          onCanvasUnregister={spectrogramOnCanvasUnregister}
        />
        <div
          style={{
            position: 'absolute',
            top: (props.index * 2 + 1) * halfHeight,
            width: props.length,
            height: halfHeight,
          }}
        >
          <Channel
            {...props}
            index={0}
            waveOutlineColor={waveOutlineColor}
            waveFillColor={waveFillColor}
            waveHeight={halfHeight}
            devicePixelRatio={devicePixelRatio}
            barWidth={barWidth}
            barGap={barGap}
            transparentBackground={transparentBackground}
            drawMode={drawMode}
          />
        </div>
      </>
    );
  }

  if (renderMode === 'piano-roll') {
    return (
      <PianoRollChannel
        index={props.index}
        midiNotes={midiNotes ?? []}
        length={props.length}
        waveHeight={waveHeight}
        devicePixelRatio={devicePixelRatio}
        samplesPerPixel={samplesPerPixel}
        sampleRate={sampleRateProp ?? contextSampleRate}
        clipOffsetSeconds={clipOffsetSeconds ?? 0}
        noteColor={theme?.pianoRollNoteColor}
        selectedNoteColor={theme?.pianoRollSelectedNoteColor}
        isSelected={isSelected}
        transparentBackground={transparentBackground}
        backgroundColor={theme?.pianoRollBackgroundColor}
      />
    );
  }

  // Default: waveform mode
  return (
    <Channel
      {...props}
      waveOutlineColor={waveOutlineColor}
      waveFillColor={waveFillColor}
      waveHeight={waveHeight}
      devicePixelRatio={devicePixelRatio}
      barWidth={barWidth}
      barGap={barGap}
      transparentBackground={transparentBackground}
      drawMode={drawMode}
    />
  );
};
