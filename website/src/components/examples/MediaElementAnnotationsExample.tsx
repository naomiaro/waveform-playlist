import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  MediaElementPlaylistProvider,
  MediaElementWaveform,
  useAnnotations,
  usePlaybackControls,
  PlayButton,
  PauseButton,
  StopButton,
  loadWaveformData,
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

const CheckboxLabel = styled.label`
  display: flex;
  gap: 0.4rem;
  align-items: center;
  font-size: 0.875rem;
  cursor: pointer;
`;

interface TransportProps {
  editable: boolean;
  onEditableChange: (editable: boolean) => void;
  linkEndpoints: boolean;
  onLinkEndpointsChange: (linked: boolean) => void;
}

function Transport({
  editable,
  onEditableChange,
  linkEndpoints,
  onLinkEndpointsChange,
}: TransportProps) {
  const { continuousPlay } = useAnnotations();
  const { setContinuousPlay } = usePlaybackControls();

  return (
    <Controls>
      <PlayButton />
      <PauseButton />
      <StopButton />
      <CheckboxLabel>
        <input
          type="checkbox"
          checked={continuousPlay}
          onChange={(e) => setContinuousPlay(e.target.checked)}
        />
        Continuous play
      </CheckboxLabel>
      <CheckboxLabel>
        <input
          type="checkbox"
          checked={editable}
          onChange={(e) => onEditableChange(e.target.checked)}
        />
        Editable
      </CheckboxLabel>
      <CheckboxLabel>
        <input
          type="checkbox"
          checked={linkEndpoints}
          disabled={!editable}
          onChange={(e) => onLinkEndpointsChange(e.target.checked)}
        />
        Link endpoints
      </CheckboxLabel>
    </Controls>
  );
}

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
  const [editable, setEditable] = useState(false);
  const [linkEndpoints, setLinkEndpoints] = useState(false);

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
  const getLabel = useCallback((_annotation: Annotation, index: number) => String(index + 1), []);

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
          waveHeight={128}
          theme={theme}
          timescale
          automaticScroll
          barWidth={2}
          barGap={1}
          annotationList={annotationList}
          onAnnotationsChange={setAnnotations}
        >
          <Transport
            editable={editable}
            onEditableChange={setEditable}
            linkEndpoints={linkEndpoints}
            onLinkEndpointsChange={setLinkEndpoints}
          />
          <MediaElementWaveform
            annotationTextHeight={300}
            getAnnotationBoxLabel={getLabel}
            editable={editable}
            linkEndpoints={linkEndpoints}
          />
        </MediaElementPlaylistProvider>
      </AnnotationProvider>
    </Container>
  );
}
