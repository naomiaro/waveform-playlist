import React from 'react';
import styled from 'styled-components';
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
  AudioPosition,
  Waveform,
  useAudioTracks,
} from '@waveform-playlist/browser';
import { EditableCheckbox } from '@waveform-playlist/annotations';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

// Load annotation data (defined globally in the page)
declare const notes: any[];

// Annotation actions for the UI
const annotationActions = [
  {
    class: 'bi bi-dash',
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
    class: 'bi bi-plus',
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
    class: 'bi bi-scissors',
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
    class: 'bi bi-trash',
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

const AnnotationsAppContent: React.FC = () => {
  return (
    <Container>
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
          <DownloadAnnotationsButton />
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

      <Waveform annotationControls={annotationActions} />

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
  const theme = useDocusaurusTheme();

  const audioConfigs = React.useMemo(() => [
    {
      src: '/waveform-playlist/media/audio/BassDrums30.mp3',
      name: 'Bass & Drums',
      annotations: typeof notes !== 'undefined' ? notes : [],
    },
  ], []);

  const { tracks, loading, error } = useAudioTracks(audioConfigs);

  if (loading) {
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
      mono={true}
      waveHeight={128}
      automaticScroll={true}
      controls={{ show: true, width: 200 }}
      theme={theme}
      annotationOptions={{
        editable: true,
        linkEndpoints: false,
        continuousPlay: false,
      }}
    >
      <AnnotationsAppContent />
    </WaveformPlaylistProvider>
  );
}
