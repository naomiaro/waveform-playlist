import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  MediaElementPlaylistProvider,
  MediaElementWaveformRoot,
  WaveformTimescale,
  WaveformTracks,
  WaveformAnnotationBoxes,
  WaveformSelection,
  WaveformPlayhead,
  AnnotationList,
  ContinuousPlayCheckbox,
  EditableCheckbox,
  LinkEndpointsCheckbox,
  PlayButton,
  PauseButton,
  StopButton,
  loadWaveformData,
  WaveformViewOptions,
} from '@waveform-playlist/browser';
import { AnnotationProvider, parseAeneas } from '@waveform-playlist/annotations';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { sonnetNotes } from './sonnetAnnotations';

const AUDIO_SRC = '/waveform-playlist/media/audio/sonnet.mp3';
// Generated with: audiowaveform -i sonnet.mp3 -o sonnet.dat -z 256 -b 8
const PEAKS_SRC = '/waveform-playlist/media/audio/sonnet.dat';

type WaveformData = Awaited<ReturnType<typeof loadWaveformData>>;
type Annotation = ReturnType<typeof parseAeneas>;

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const Controls = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  background: var(--ifm-background-surface-color, #f8f9fa);
  border: 1px solid var(--ifm-color-emphasis-300, #dee2e6);
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

// The three annotation options are the provider's: the checkboxes show and
// set them, and the boxes and the list read them.
function Transport() {
  return (
    <Controls>
      <PlayButton />
      <PauseButton />
      <StopButton />
      <ContinuousPlayCheckbox />
      <EditableCheckbox />
      <LinkEndpointsCheckbox />
    </Controls>
  );
}

// Defined outside the component: a new function would render every box.
const getLabel = (_annotation: Annotation, index: number) => String(index + 1);

/**
 * MediaElementAnnotationsExample
 *
 * A streamed audio file (HTMLAudioElement, no Tone.js) with time-synced
 * annotations: boxes under the waveform and a text list that follows playback.
 */
export function MediaElementAnnotationsExample() {
  const { theme } = useDocusaurusTheme();
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>(() =>
    sonnetNotes.map(parseAeneas)
  );

  useEffect(() => {
    let cancelled = false;
    loadWaveformData(PEAKS_SRC)
      .then((data) => {
        if (!cancelled) setWaveformData(data);
      })
      .catch((err) => {
        console.error('Error loading peaks: ' + String(err));
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load peaks');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const track = useMemo(
    () => (waveformData ? { source: AUDIO_SRC, waveformData, name: 'Sonnet' } : null),
    [waveformData]
  );
  const annotationList = useMemo(() => ({ annotations, isContinuousPlay: true }), [annotations]);

  if (error) {
    return <Container style={{ padding: '2rem', color: 'red' }}>Error: {error}</Container>;
  }

  if (!track) {
    return (
      <Container style={{ padding: '2rem', textAlign: 'center' }}>Loading waveform data...</Container>
    );
  }

  return (
    <Container>
      <AnnotationProvider>
        <MediaElementPlaylistProvider
          track={track}
          samplesPerPixel={1024}
          theme={theme}
          automaticScroll
          annotationList={annotationList}
          onAnnotationsChange={setAnnotations}
        >
          <Transport />
          <WaveformViewOptions waveHeight={128} barWidth={2} barGap={1}>
            <MediaElementWaveformRoot>
              <WaveformTimescale />
              <WaveformTracks />
              <WaveformAnnotationBoxes getLabel={getLabel} />
              <WaveformSelection />
              <WaveformPlayhead />
            </MediaElementWaveformRoot>
          </WaveformViewOptions>
          <AnnotationList height={300} />
        </MediaElementPlaylistProvider>
      </AnnotationProvider>
    </Container>
  );
}
