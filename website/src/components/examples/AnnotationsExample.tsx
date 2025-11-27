import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  RewindButton,
  FastForwardButton,
  ZoomInButton,
  ZoomOutButton,
  MasterVolumeControl,
  TimeFormatSelect,
  SelectionTimeInputs,
  AutomaticScrollCheckbox,
  ContinuousPlayCheckbox,
  LinkEndpointsCheckbox,
  DownloadAnnotationsButton,
  EditableCheckbox,
  AudioPosition,
  Waveform,
  usePlaylistData,
  usePlaylistState,
  usePlaylistControls,
  usePlaybackAnimation,
  useAnnotationDragHandlers,
  useAnnotationKeyboardControls,
  useDragSensors,
} from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

// Annotation data - Shakespeare's Sonnet 1
const defaultNotes = [
  {
    "begin": "0.000",
    "children": [],
    "end": "2.680",
    "id": "f000001",
    "language": "eng",
    "lines": ["1"]
  },
  {
    "begin": "2.680",
    "children": [],
    "end": "5.880",
    "id": "f000002",
    "language": "eng",
    "lines": ["From fairest creatures we desire increase,"]
  },
  {
    "begin": "5.880",
    "children": [],
    "end": "9.240",
    "id": "f000003",
    "language": "eng",
    "lines": ["That thereby beauty's rose might never die,"]
  },
  {
    "begin": "9.240",
    "children": [],
    "end": "11.920",
    "id": "f000004",
    "language": "eng",
    "lines": ["But as the riper should by time decease,"]
  },
  {
    "begin": "11.920",
    "children": [],
    "end": "15.280",
    "id": "f000005",
    "language": "eng",
    "lines": ["His tender heir might bear his memory:"]
  },
  {
    "begin": "15.280",
    "children": [],
    "end": "18.600",
    "id": "f000006",
    "language": "eng",
    "lines": ["But thou contracted to thine own bright eyes,"]
  },
  {
    "begin": "18.600",
    "children": [],
    "end": "22.800",
    "id": "f000007",
    "language": "eng",
    "lines": ["Feed'st thy light's flame with self-substantial fuel,"]
  },
  {
    "begin": "22.800",
    "children": [],
    "end": "25.680",
    "id": "f000008",
    "language": "eng",
    "lines": ["Making a famine where abundance lies,"]
  },
  {
    "begin": "25.680",
    "children": [],
    "end": "31.240",
    "id": "f000009",
    "language": "eng",
    "lines": ["Thy self thy foe, to thy sweet self too cruel:"]
  },
  {
    "begin": "31.240",
    "children": [],
    "end": "34.280",
    "id": "f000010",
    "language": "eng",
    "lines": ["Thou that art now the world's fresh ornament,"]
  },
  {
    "begin": "34.280",
    "children": [],
    "end": "36.960",
    "id": "f000011",
    "language": "eng",
    "lines": ["And only herald to the gaudy spring,"]
  },
  {
    "begin": "36.960",
    "children": [],
    "end": "40.680",
    "id": "f000012",
    "language": "eng",
    "lines": ["Within thine own bud buriest thy content,"]
  },
  {
    "begin": "40.680",
    "children": [],
    "end": "44.560",
    "id": "f000013",
    "language": "eng",
    "lines": ["And tender churl mak'st waste in niggarding:"]
  },
  {
    "begin": "44.560",
    "children": [],
    "end": "48.080",
    "id": "f000014",
    "language": "eng",
    "lines": ["Pity the world, or else this glutton be,"]
  },
  {
    "begin": "48.080",
    "children": [],
    "end": "53.240",
    "id": "f000015",
    "language": "eng",
    "lines": ["To eat the world's due, by the grave and thee."]
  }
];

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

const DropZone = styled.div<{ $isDragging: boolean }>`
  padding: 1.5rem;
  border: 2px dashed ${(props) => (props.$isDragging ? '#3498db' : 'var(--ifm-color-emphasis-400, #ced4da)')};
  border-radius: 0.5rem;
  text-align: center;
  background: ${(props) => (props.$isDragging ? 'rgba(52, 152, 219, 0.1)' : 'var(--ifm-background-surface-color, #f8f9fa)')};
  transition: all 0.2s ease-in-out;
  cursor: pointer;

  &:hover {
    border-color: #3498db;
    background: var(--ifm-color-emphasis-100, #e3f2fd);
  }
`;

const DropZoneText = styled.p`
  margin: 0;
  color: var(--ifm-font-color-base, #495057);
  font-size: 0.9rem;
`;

const HiddenFileInput = styled.input`
  display: none;
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

const DangerButton = styled(ActionButton)`
  color: var(--ifm-color-danger, #dc3545);
  border-color: var(--ifm-color-danger, #dc3545);

  &:hover {
    background: var(--ifm-color-danger, #dc3545);
    color: white;
  }
`;

const SuccessButton = styled(ActionButton)`
  /* Same as ActionButton - no special styling */
`;

interface AnnotationsAppContentProps {
  tracks: ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
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
  const { samplesPerPixel, sampleRate, duration, controls } = usePlaylistData();
  const { annotations, linkEndpoints, activeAnnotationId, continuousPlay } = usePlaylistState();
  const { setAnnotations, setActiveAnnotationId, scrollContainerRef, play } = usePlaylistControls();
  const { currentTime } = usePlaybackAnimation();

  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const sensors = useDragSensors();
  const { onDragStart, onDragMove, onDragEnd } = useAnnotationDragHandlers({
    annotations,
    onAnnotationsChange: setAnnotations,
    samplesPerPixel,
    sampleRate,
    duration,
    linkEndpoints,
  });

  useAnnotationKeyboardControls({
    annotations,
    activeAnnotationId,
    onAnnotationsChange: setAnnotations,
    onActiveAnnotationChange: setActiveAnnotationId,
    duration,
    linkEndpoints,
    continuousPlay,
    scrollContainerRef,
    samplesPerPixel,
    sampleRate,
    controlsWidth: controls.show ? controls.width : 0,
    onPlay: play,
  });

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

    const gap = findNextAvailableGap(currentTime);

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
  }, [currentTime, annotations, duration, setAnnotations, defaultAnnotationDuration, findNextAvailableGap]);

  // Keyboard shortcut: 'A' to add annotation at playhead
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        addAnnotationAtPlayhead();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [addAnnotationAtPlayhead]);

  // Load audio files
  const loadAudioFiles = async (files: File[]) => {
    setIsLoadingAudio(true);
    try {
      const audioContext = Tone.getContext().rawContext as AudioContext;
      const audioFiles = Array.from(files).filter((file) =>
        file.type.startsWith('audio/')
      );

      const newTracks: ClipTrack[] = await Promise.all(
        audioFiles.map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          const clip = createClipFromSeconds({
            audioBuffer,
            startTime: 0,
            duration: audioBuffer.duration,
            offset: 0,
            name: file.name.replace(/\.[^/.]+$/, ''),
          });

          return createTrack({
            name: file.name.replace(/\.[^/.]+$/, ''),
            clips: [clip],
            muted: false,
            soloed: false,
            volume: 1,
            pan: 0,
          });
        })
      );

      onTracksChange([...tracks, ...newTracks]);
    } catch (error) {
      console.error('Error loading audio files:', error);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // Handle file drop
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files) as File[];
      if (files.length > 0) {
        loadAudioFiles(files);
      }
    },
    [tracks]
  );

  // Handle file input change
  const handleAudioInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        loadAudioFiles(Array.from(files) as File[]);
      }
    },
    [tracks]
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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      modifiers={[restrictToHorizontalAxis]}
    >
      <Container>
        {/* Drop Zone for Audio */}
        <DropZone
          $isDragging={isDragging}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => audioInputRef.current?.click()}
        >
          <DropZoneText>
            {isLoadingAudio
              ? 'Loading audio...'
              : isDragging
              ? 'Drop audio files here'
              : 'Drop audio files here or click to browse'}
          </DropZoneText>
        </DropZone>

        <HiddenFileInput
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          multiple
          onChange={handleAudioInput}
        />

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
            <DangerButton onClick={onClearAll}>
              Clear All
            </DangerButton>
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

        <Waveform
          annotationControls={annotationActions}
          annotationTextHeight={300}
        />

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
    </DndContext>
  );
};

export function AnnotationsExample() {
  const { theme } = useDocusaurusTheme();
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [annotations, setAnnotations] = useState<any[]>(defaultNotes);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load default audio track on mount
  React.useEffect(() => {
    const loadDefaultTrack = async () => {
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
        console.error('Error loading default track:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsLoading(false);
      }
    };

    loadDefaultTrack();
  }, []);

  const handleAnnotationsLoaded = useCallback((newAnnotations: any[]) => {
    setAnnotations(newAnnotations);
  }, []);

  const handleClearAll = useCallback(() => {
    setTracks([]);
    setAnnotations([]);
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading audio track with annotations...
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
      waveHeight={128}
      automaticScroll={true}
      controls={{ show: true, width: 200 }}
      theme={theme}
      timescale
      barWidth={4}
      barGap={0}
      progressBarWidth={2}
      annotationList={{
        annotations: annotations,
        editable: true,
        linkEndpoints: true,
        isContinuousPlay: true,
      }}
    >
      <AnnotationsAppContent
        tracks={tracks}
        onTracksChange={setTracks}
        onAnnotationsLoaded={handleAnnotationsLoaded}
        onClearAll={handleClearAll}
      />
    </WaveformPlaylistProvider>
  );
}
