/**
 * Mobile-optimized Annotations Example
 *
 * Demonstrates touch-friendly annotation editing:
 * - Touch delay (250ms) to distinguish drag from scroll gestures
 * - Simplified controls optimized for mobile screens
 * - Larger touch targets for annotation boundaries
 * - Streamlined UI with collapsible sections
 *
 * Usage tip: Touch and hold an annotation boundary to resize.
 * Tap an annotation to select it and play from that point.
 */
import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { DndContext } from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import * as Tone from 'tone';
import { createTrack, createClipFromSeconds, type ClipTrack } from '@waveform-playlist/core';
import {
  WaveformPlaylistProvider,
  PlayButton,
  PauseButton,
  StopButton,
  ZoomInButton,
  ZoomOutButton,
  AudioPosition,
  ContinuousPlayCheckbox,
  LinkEndpointsCheckbox,
  Waveform,
  usePlaylistData,
  usePlaylistState,
  usePlaylistControls,
  usePlaybackAnimation,
  useAnnotationDragHandlers,
  useDragSensors,
} from '@waveform-playlist/browser';
import { AnnotationProvider, parseAeneas } from '@waveform-playlist/annotations';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

// Full annotation data - Shakespeare's Sonnet 1
const mobileAnnotations = [
  {
    "begin": "0.000",
    "end": "2.680",
    "id": "f000001",
    "language": "eng",
    "lines": ["1"]
  },
  {
    "begin": "2.680",
    "end": "5.880",
    "id": "f000002",
    "language": "eng",
    "lines": ["From fairest creatures we desire increase,"]
  },
  {
    "begin": "5.880",
    "end": "9.240",
    "id": "f000003",
    "language": "eng",
    "lines": ["That thereby beauty's rose might never die,"]
  },
  {
    "begin": "9.240",
    "end": "11.920",
    "id": "f000004",
    "language": "eng",
    "lines": ["But as the riper should by time decease,"]
  },
  {
    "begin": "11.920",
    "end": "15.280",
    "id": "f000005",
    "language": "eng",
    "lines": ["His tender heir might bear his memory:"]
  },
  {
    "begin": "15.280",
    "end": "18.600",
    "id": "f000006",
    "language": "eng",
    "lines": ["But thou contracted to thine own bright eyes,"]
  },
  {
    "begin": "18.600",
    "end": "22.800",
    "id": "f000007",
    "language": "eng",
    "lines": ["Feed'st thy light's flame with self-substantial fuel,"]
  },
  {
    "begin": "22.800",
    "end": "25.680",
    "id": "f000008",
    "language": "eng",
    "lines": ["Making a famine where abundance lies,"]
  },
  {
    "begin": "25.680",
    "end": "31.240",
    "id": "f000009",
    "language": "eng",
    "lines": ["Thy self thy foe, to thy sweet self too cruel:"]
  },
  {
    "begin": "31.240",
    "end": "34.280",
    "id": "f000010",
    "language": "eng",
    "lines": ["Thou that art now the world's fresh ornament,"]
  },
  {
    "begin": "34.280",
    "end": "36.960",
    "id": "f000011",
    "language": "eng",
    "lines": ["And only herald to the gaudy spring,"]
  },
  {
    "begin": "36.960",
    "end": "40.680",
    "id": "f000012",
    "language": "eng",
    "lines": ["Within thine own bud buriest thy content,"]
  },
  {
    "begin": "40.680",
    "end": "44.560",
    "id": "f000013",
    "language": "eng",
    "lines": ["And tender churl mak'st waste in niggarding:"]
  },
  {
    "begin": "44.560",
    "end": "48.080",
    "id": "f000014",
    "language": "eng",
    "lines": ["Pity the world, or else this glutton be,"]
  },
  {
    "begin": "48.080",
    "end": "53.240",
    "id": "f000015",
    "language": "eng",
    "lines": ["To eat the world's due, by the grave and thee."]
  }
];

// Simplified annotation actions for mobile (larger touch targets)
const mobileAnnotationActions = [
  {
    text: '−',
    title: 'Shrink',
    action: (annotation: any, i: number, annotations: any[], opts: any) => {
      annotation.end -= 0.1; // Larger increment for touch
      if (annotation.begin !== undefined) {
        annotation.begin = annotation.end.toString();
      }
    }
  },
  {
    text: '+',
    title: 'Extend',
    action: (annotation: any, i: number, annotations: any[], opts: any) => {
      annotation.end += 0.1; // Larger increment for touch
      if (annotation.begin !== undefined) {
        annotation.begin = annotation.end.toString();
      }
    }
  },
];

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  user-select: none;
  -webkit-user-select: none;
  overscroll-behavior: contain;
`;

const Instructions = styled.div`
  background: var(--ifm-background-surface-color, #f8f9fa);
  border: 1px solid var(--ifm-color-emphasis-300, #dadde1);
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ifm-font-color-base);

  strong {
    display: block;
    margin-bottom: 4px;
    color: var(--ifm-color-primary);
  }

  ul {
    margin: 8px 0 0 0;
    padding-left: 20px;
  }

  li {
    margin-bottom: 4px;
  }

  li strong {
    display: inline;
    margin-bottom: 0;
  }
`;

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  background: var(--ifm-background-surface-color, #f8f9fa);
  border-radius: 8px;
  align-items: center;

  /* Make buttons larger on mobile */
  button {
    min-width: 44px;
    min-height: 44px;
    padding: 8px 12px;
  }
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 4px;
  align-items: center;
`;

const Separator = styled.div`
  width: 1px;
  height: 32px;
  background: var(--ifm-color-emphasis-300, #ddd);
  margin: 0 4px;
`;

const AnnotationInfo = styled.div`
  padding: 12px;
  background: var(--ifm-background-surface-color, #f8f9fa);
  border-radius: 8px;
  font-size: 14px;

  p {
    margin: 0 0 8px 0;
  }

  strong {
    color: var(--ifm-color-primary, #3578e5);
  }
`;

interface MobileAnnotationsContentProps {
  tracks: ClipTrack[];
}

const MobileAnnotationsContent: React.FC<MobileAnnotationsContentProps> = ({ tracks }) => {
  const { samplesPerPixel, sampleRate, duration, controls } = usePlaylistData();
  const { annotations, linkEndpoints, activeAnnotationId, continuousPlay } = usePlaylistState();
  const { setAnnotations, setActiveAnnotationId, play } = usePlaylistControls();
  const { currentTime } = usePlaybackAnimation();

  // Use touch-optimized sensors with 250ms delay
  const sensors = useDragSensors({ touchOptimized: true });

  const { onDragStart, onDragMove, onDragEnd } = useAnnotationDragHandlers({
    annotations,
    onAnnotationsChange: setAnnotations,
    samplesPerPixel,
    sampleRate,
    duration,
    linkEndpoints,
  });

  // Find active annotation for display
  const activeAnnotation = annotations.find(a => a.id === activeAnnotationId);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      modifiers={[restrictToHorizontalAxis]}
    >
      <Container>
        <Instructions>
          <strong>Touch Controls</strong>
          <ul>
            <li><strong>Play annotation:</strong> Tap an annotation box</li>
            <li><strong>Resize:</strong> Touch and hold boundary (250ms), then drag</li>
            <li><strong>Link Endpoints:</strong> Toggle to keep adjacent annotations connected</li>
            <li><strong>Scroll:</strong> Swipe left/right on the waveform</li>
          </ul>
        </Instructions>

        <Controls>
          <ControlGroup>
            <PlayButton />
            <PauseButton />
            <StopButton />
          </ControlGroup>

          <Separator />

          <ControlGroup>
            <ZoomInButton />
            <ZoomOutButton />
          </ControlGroup>

          <Separator />

          <ControlGroup>
            <AudioPosition />
          </ControlGroup>

          <Separator />

          <ControlGroup>
            <ContinuousPlayCheckbox />
            <LinkEndpointsCheckbox />
          </ControlGroup>
        </Controls>

        <Waveform
          annotationControls={mobileAnnotationActions}
          annotationTextHeight={200}
        />

        {activeAnnotation && (
          <AnnotationInfo>
            <p><strong>Selected:</strong> {activeAnnotation.lines?.join(' ') || 'No text'}</p>
            <p>
              Time: {activeAnnotation.start?.toFixed(2)}s - {activeAnnotation.end?.toFixed(2)}s
              ({((activeAnnotation.end || 0) - (activeAnnotation.start || 0)).toFixed(2)}s)
            </p>
          </AnnotationInfo>
        )}
      </Container>
    </DndContext>
  );
};

export function MobileAnnotationsExample() {
  const { theme } = useDocusaurusTheme();
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [annotations, setAnnotations] = useState<any[]>(() => mobileAnnotations.map(parseAeneas));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTrack = async () => {
      try {
        const audioContext = Tone.getContext().rawContext as AudioContext;
        const response = await fetch('/waveform-playlist/media/audio/sonnet.mp3');
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const clip = createClipFromSeconds({
          audioBuffer,
          startTime: 0,
          duration: audioBuffer.duration,
          offset: 0,
          name: 'Sonnet',
        });

        const track = createTrack({
          name: 'Sonnet',
          clips: [clip],
          muted: false,
          soloed: false,
          volume: 1,
          pan: 0,
        });

        setTracks([track]);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading track:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsLoading(false);
      }
    };

    loadTrack();
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading audio with annotations...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: 'red' }}>
        Error loading audio: {error}
      </div>
    );
  }

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={1024}
      mono
      waveHeight={100}
      automaticScroll={false}
      controls={{ show: false, width: 0 }}
      theme={theme}
      timescale
      barWidth={4}
      barGap={2}
      annotationList={{
        annotations: annotations,
        editable: true,
        linkEndpoints: true,
        isContinuousPlay: true,
      }}
      onAnnotationsChange={setAnnotations}
    >
      <AnnotationProvider>
        <MobileAnnotationsContent tracks={tracks} />
      </AnnotationProvider>
    </WaveformPlaylistProvider>
  );
}
