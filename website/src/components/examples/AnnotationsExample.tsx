import React, { useState, useCallback, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { FileDropZone } from '../FileDropZone';
import {
  audioTrack,
  keyBelongsToFocusedControl,
  type PlaylistTrack,
} from '@waveform-playlist/core';
import {
  WaveformPlaylistProvider,
  PlayButton,
  PauseButton,
  StopButton,
  RewindButton,
  FastForwardButton,
  ZoomInButton,
  ZoomOutButton,
  MasterVolumeControl,
  TimeFormatSelect,
  SelectionTimeInputs,
  AutomaticScrollCheckbox,
  AudioPosition,
  WaveformRoot,
  WaveformTimescale,
  WaveformLoopRegion,
  WaveformTrackControls,
  WaveformTracks,
  WaveformAnnotationBoxes,
  WaveformSelection,
  WaveformPlayhead,
  AnnotationList,
  usePlaybackControls,
  KeyboardShortcuts,
  ClearAllButton,
  usePlaylistTimeline,
  usePlaybackRefs,
  useAnnotations,
  WaveformViewOptions,
} from '@waveform-playlist/browser';
import {
  AnnotationProvider,
  parseAeneas,
  ContinuousPlayCheckbox,
  LinkEndpointsCheckbox,
  DownloadAnnotationsButton,
  EditableCheckbox,
} from '@waveform-playlist/annotations';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { useLoadingProgress } from '../../hooks/useLoadingProgress';
import { sonnetNotes as defaultNotes } from './sonnetAnnotations';


// Annotation actions for the UI
const annotationActions = [
  {
    text: '−',
    title: 'Reduce annotation end by 0.010s',
    action: (annotation: any, i: number, annotations: any[], opts: any) => {
      const delta = 0.010;
      annotation.end -= delta;

      if (opts.linkEndpoints) {
        const next = annotations[i + 1];
        if (next) {
          next.start -= delta;
          if (next.begin !== undefined) {
            next.begin = next.start.toString();
          }
        }
      }
      if (annotation.begin !== undefined) {
        annotation.begin = annotation.end.toString();
      }
    }
  },
  {
    text: '+',
    title: 'Increase annotation end by 0.010s',
    action: (annotation: any, i: number, annotations: any[], opts: any) => {
      const delta = 0.010;
      annotation.end += delta;

      if (opts.linkEndpoints) {
        const next = annotations[i + 1];
        if (next) {
          next.start += delta;
          if (next.begin !== undefined) {
            next.begin = next.start.toString();
          }
        }
      }
      if (annotation.begin !== undefined) {
        annotation.begin = annotation.end.toString();
      }
    }
  },
  {
    text: '✂',
    title: 'Split annotation in half',
    action: (annotation: any, i: number, annotations: any[]) => {
      const halfDuration = (annotation.end - annotation.start) / 2;

      annotations.splice(i + 1, 0, {
        id: 'annotation_' + Date.now(),
        start: annotation.end - halfDuration,
        end: annotation.end,
        begin: (annotation.end - halfDuration).toString(),
        lines: ['----'],
        language: 'en',
      });

      annotation.end = annotation.start + halfDuration;
      if (annotation.begin !== undefined) {
        annotation.begin = annotation.end.toString();
      }
    }
  },
  {
    text: '🗑',
    title: 'Delete annotation',
    action: (annotation: any, i: number, annotations: any[]) => {
      annotations.splice(i, 1);
    }
  }
];

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const TopBar = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  background: var(--ifm-background-surface-color, #f5f5f5);
  border: 1px solid var(--ifm-color-emphasis-300, #ddd);
  border-radius: 0.25rem;
  flex-wrap: wrap;
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const Separator = styled.div`
  width: 1px;
  height: 2rem;
  background: var(--ifm-color-emphasis-300, #ddd);
`;

const TimeControlsBar = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: var(--ifm-background-surface-color, #f5f5f5);
  border: 1px solid var(--ifm-color-emphasis-300, #ddd);
  border-radius: 0.25rem;
  flex-wrap: wrap;
`;

const HiddenFileInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
`;

const ActionButton = styled.button`
  padding: 0.5rem 1rem;
  background: var(--ifm-background-surface-color, #f5f5f5);
  color: var(--ifm-font-color-base, #333);
  border: 1px solid var(--ifm-color-emphasis-300, #ddd);
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.15s ease;

  &:hover {
    background: var(--ifm-color-emphasis-200, #e8e8e8);
    border-color: var(--ifm-color-emphasis-400, #ccc);
  }

  &:disabled {
    background: var(--ifm-color-emphasis-200, #e8e8e8);
    color: var(--ifm-color-emphasis-500, #999);
    cursor: not-allowed;
  }
`;


const SuccessButton = styled(ActionButton)`
  /* Same as ActionButton - no special styling */
`;

// The drop zone, showing "Loading audio..." while a source loads. A component
// of its own so that a source settling does not render the page.
const AudioDropZone: React.FC<{ onFiles: (files: File[]) => void }> = ({ onFiles }) => {
  const { isLoading } = useLoadingProgress();
  return (
    <FileDropZone
      accept="audio/*"
      onFiles={onFiles}
      fileFilter={(f) => f.type.startsWith('audio/')}
      label="Drop audio files here or click to browse"
      dragLabel="Drop audio files here"
      loadingContent={isLoading ? <p style={{ margin: 0 }}>Loading audio...</p> : undefined}
    />
  );
};

// Inside the provider: the loading message until the first build, or the error
// if the default track could not be loaded; then the example.
const InitialLoadGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isReady } = usePlaylistTimeline();
  const { errorMessage } = useLoadingProgress();
  const [loaded, setLoaded] = useState(false);
  if (isReady && !errorMessage && !loaded) setLoaded(true);

  if (loaded) return <>{children}</>;
  if (errorMessage) {
    return (
      <div style={{ padding: '2rem', color: 'red' }}>
        Error loading audio: {errorMessage}
      </div>
    );
  }
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      Loading audio track with annotations...
    </div>
  );
};

interface AnnotationsAppContentProps {
  tracks: PlaylistTrack[];
  onTracksChange: React.Dispatch<React.SetStateAction<PlaylistTrack[]>>;
  onAnnotationsLoaded: (annotations: any[]) => void;
  onClearAll: () => void;
  /** Default duration for new annotations in seconds (default: 3.0) */
  defaultAnnotationDuration?: number;
  /** Minimum duration for new annotations in seconds (default: 0.5) */
  minAnnotationDuration?: number;
}

const AnnotationsAppContent: React.FC<AnnotationsAppContentProps> = ({
  tracks,
  onTracksChange,
  onAnnotationsLoaded,
  onClearAll,
  defaultAnnotationDuration = 3.0,
  minAnnotationDuration = 0.5,
}) => {
  const { duration } = usePlaylistTimeline();
  const { annotations } = useAnnotations();
  const { setAnnotations } = usePlaybackControls();
  // The ref, not `useCurrentTime()`: the position is only needed when the
  // button is pressed, and this component renders the whole page.
  const { currentTimeRef } = usePlaybackRefs();

  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Find the next available gap for an annotation starting from a given time
  const findNextAvailableGap = useCallback((startFrom: number): { start: number; maxEnd: number } | null => {
    if (duration <= 0) return null;

    const sortedAnnotations = [...annotations].sort((a, b) => a.start - b.start);

    // Check if we're inside an existing annotation
    const containingAnnotation = sortedAnnotations.find(
      (a) => startFrom >= a.start && startFrom < a.end
    );

    let gapStart: number;
    let searchFromIndex: number;

    if (containingAnnotation) {
      // Start searching after this annotation ends
      gapStart = containingAnnotation.end;
      searchFromIndex = sortedAnnotations.indexOf(containingAnnotation) + 1;
    } else {
      // We're in a gap, start from current position
      gapStart = startFrom;
      searchFromIndex = sortedAnnotations.findIndex((a) => a.start > startFrom);
      if (searchFromIndex === -1) searchFromIndex = sortedAnnotations.length;
    }

    // Find the next annotation after our gap start (if any)
    const nextAnnotation = sortedAnnotations[searchFromIndex];
    const gapEnd = nextAnnotation ? nextAnnotation.start : duration;

    // Check if there's enough space
    if (gapEnd - gapStart >= minAnnotationDuration) {
      return { start: gapStart, maxEnd: gapEnd };
    }

    // No space here, look for the next gap
    // Iterate through remaining annotations looking for gaps between them
    for (let i = searchFromIndex; i < sortedAnnotations.length; i++) {
      const current = sortedAnnotations[i];
      const next = sortedAnnotations[i + 1];
      const potentialGapStart = current.end;
      const potentialGapEnd = next ? next.start : duration;

      if (potentialGapEnd - potentialGapStart >= minAnnotationDuration) {
        return { start: potentialGapStart, maxEnd: potentialGapEnd };
      }
    }

    return null; // No available gap found
  }, [annotations, duration, minAnnotationDuration]);

  // Add annotation at current playhead position or next available gap
  const addAnnotationAtPlayhead = useCallback(() => {
    if (duration <= 0) return;

    const gap = findNextAvailableGap(currentTimeRef.current ?? 0);

    if (!gap) {
      console.warn('Cannot create annotation: no available space found');
      return;
    }

    // Calculate available space
    const availableSpace = gap.maxEnd - gap.start;

    // Use default duration if there's enough space, otherwise fill available space
    const annotationDuration = Math.min(defaultAnnotationDuration, availableSpace);
    const endTime = gap.start + annotationDuration;

    const newAnnotation = {
      id: 'annotation_' + Date.now(),
      start: gap.start,
      end: endTime,
      begin: gap.start.toFixed(3),
      lines: ['New annotation'],
      language: 'en',
    };

    // Insert in chronological order
    const sortedAnnotations = [...annotations].sort((a, b) => a.start - b.start);
    const insertIndex = sortedAnnotations.findIndex((a) => a.start > gap.start);
    const newAnnotations =
      insertIndex === -1
        ? [...sortedAnnotations, newAnnotation]
        : [
            ...sortedAnnotations.slice(0, insertIndex),
            newAnnotation,
            ...sortedAnnotations.slice(insertIndex),
          ];

    setAnnotations(newAnnotations);
  }, [currentTimeRef, annotations, duration, setAnnotations, defaultAnnotationDuration, findNextAvailableGap]);

  // Keyboard shortcut: 'A' to add annotation at playhead
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Leave the key to a focused text field, dropdown or other control
      if (keyBelongsToFocusedControl(e)) return;

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        addAnnotationAtPlayhead();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [addAnnotationAtPlayhead]);

  // Handle dropped/selected audio files: one track per file, loaded by the provider
  const handleFiles = useCallback(
    (files: File[]) => {
      const audioFiles = files.filter((f) => f.type.startsWith('audio/'));
      if (audioFiles.length === 0) return;

      onTracksChange(prevTracks => [...prevTracks, ...audioFiles.map((file) => audioTrack({ src: file }))]);
    },
    [onTracksChange]
  );

  // Handle JSON upload
  const handleJsonUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const jsonData = JSON.parse(event.target?.result as string);
          // Support both array format and object with annotations property
          const annotationsArray = Array.isArray(jsonData) ? jsonData : jsonData.annotations;
          if (Array.isArray(annotationsArray)) {
            onAnnotationsLoaded(annotationsArray);
          } else {
            console.error('Invalid annotations format');
          }
        } catch (error) {
          console.error('Error parsing JSON:', error);
        }
      };
      reader.readAsText(file);
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [onAnnotationsLoaded]
  );

  return (
      <Container>
        <KeyboardShortcuts playback annotations />
        {/* Drop Zone for Audio */}
        <AudioDropZone onFiles={handleFiles} />

        <TopBar>
          <ControlGroup>
            <PlayButton />
            <PauseButton />
            <StopButton />
            <RewindButton />
            <FastForwardButton />
          </ControlGroup>

          <Separator />

          <ControlGroup>
            <ZoomInButton />
            <ZoomOutButton />
          </ControlGroup>

          <Separator />

          <ControlGroup>
            <SuccessButton
              onClick={addAnnotationAtPlayhead}
              title="Add annotation at playhead (A)"
            >
              + Add Annotation
            </SuccessButton>
            <DownloadAnnotationsButton />
            <ActionButton onClick={() => jsonInputRef.current?.click()}>
              Upload JSON
            </ActionButton>
            <ClearAllButton onClearAll={onClearAll} />
            <HiddenFileInput
              ref={jsonInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleJsonUpload}
            />
          </ControlGroup>

          <Separator />

          <ControlGroup>
            <AutomaticScrollCheckbox />
            <ContinuousPlayCheckbox />
            <LinkEndpointsCheckbox />
            <EditableCheckbox />
          </ControlGroup>

          <Separator />

          <ControlGroup>
            <MasterVolumeControl />
          </ControlGroup>
        </TopBar>

        {/* The annotation boxes wire the drag of their edges themselves;
            the list takes its options (height, action buttons) as props. */}
        <WaveformViewOptions waveHeight={128} barWidth={4} barGap={0} progressBarWidth={2}>
          <WaveformRoot>
            <WaveformTimescale />
            <WaveformLoopRegion />
            <WaveformTrackControls />
            <WaveformTracks />
            <WaveformAnnotationBoxes />
            <WaveformSelection />
            <WaveformPlayhead />
          </WaveformRoot>
        </WaveformViewOptions>
        <AnnotationList actions={annotationActions} height={300} />

        <TimeControlsBar>
          <ControlGroup>
            <TimeFormatSelect />
          </ControlGroup>

          <Separator />

          <ControlGroup>
            <SelectionTimeInputs />
          </ControlGroup>

          <Separator />

          <ControlGroup>
            <AudioPosition />
          </ControlGroup>
        </TimeControlsBar>
      </Container>
  );
};

export function AnnotationsExample() {
  const { theme } = useDocusaurusTheme();
  // The default track names its audio; the provider loads it.
  const [tracks, setTracks] = useState<PlaylistTrack[]>(() => [
    audioTrack({ src: '/waveform-playlist/media/audio/sonnet.mp3', name: 'Sonnet' }),
  ]);
  const [annotations, setAnnotations] = useState<any[]>(() => defaultNotes.map(parseAeneas));

  const handleAnnotationsLoaded = useCallback((newAnnotations: any[]) => {
    // Parse from Aeneas format if needed
    const parsed = newAnnotations.map((ann: any) =>
      typeof ann.start === 'number' ? ann : parseAeneas(ann)
    );
    setAnnotations(parsed);
  }, []);

  const handleClearAll = useCallback(() => {
    setTracks([]);
    setAnnotations([]);
  }, []);

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      sampleRate={48000}
      samplesPerPixel={1024}
      mono
      automaticScroll={true}
      theme={theme}
      annotationList={{
        annotations: annotations,
        editable: true,
        linkEndpoints: true,
        isContinuousPlay: true,
      }}
      onAnnotationsChange={setAnnotations}
    >
      <InitialLoadGate>
        <AnnotationProvider>
          <AnnotationsAppContent
            tracks={tracks}
            onTracksChange={setTracks}
            onAnnotationsLoaded={handleAnnotationsLoaded}
            onClearAll={handleClearAll}
          />
        </AnnotationProvider>
      </InitialLoadGate>
    </WaveformPlaylistProvider>
  );
}
