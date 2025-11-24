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
  EditableCheckbox,
  AudioPosition,
  Waveform,
  useAudioTracks,
} from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

// Annotation data - Shakespeare's Sonnet 1
const notes = [
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
// Using text labels instead of Bootstrap icons for Docusaurus compatibility
const annotationActions = [
  {
    text: '−',  // minus sign
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
    text: '✂',  // scissors
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
    text: '🗑',  // trash
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
      src: '/waveform-playlist/media/audio/sonnet.mp3',
      name: 'Sonnet',
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
      annotationList={{
        annotations: notes,
        editable: true,
        linkEndpoints: true,
        isContinuousPlay: false,
      }}
    >
      <AnnotationsAppContent />
    </WaveformPlaylistProvider>
  );
}
