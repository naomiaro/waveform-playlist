import styled from 'styled-components';
import {
  PlayButton,
  PauseButton,
  StopButton,
  PlaybackRateSelect,
  AudioPosition,
} from '@waveform-playlist/browser';

const Bar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  align-items: center;
  padding: 0.9rem 1.1rem;
  margin-bottom: 0.75rem;
  background: #1f1f2b;
  border: 1px solid #2c2c3a;
  border-radius: 0.5rem;
`;

const Group = styled.div`
  display: flex;
  gap: 0.4rem;
  align-items: center;
`;

const Button = styled.button<{ $active?: boolean }>`
  padding: 0.45rem 0.8rem;
  border: 1px solid ${(p) => (p.$active ? '#63C75F' : '#3a3a4a')};
  border-radius: 0.3rem;
  background: ${(p) => (p.$active ? '#63C75F' : '#26263340')};
  color: ${(p) => (p.$active ? '#16161e' : '#e6e6ea')};
  font-size: 0.9rem;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: #63c75f;
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const Label = styled.span`
  font-size: 0.8rem;
  color: #9a9aa6;
`;

// The library's position display, in this page's colours.
const Time = styled(AudioPosition)`
  font-family: 'Courier New', monospace;
  font-size: 0.95rem;
  color: #c49a6c;
  min-width: 96px;
  text-align: center;
`;

interface ControlsProps {
  preservesPitch: boolean;
  onPreservesPitchChange: (value: boolean) => void;
}

export function Controls({ preservesPitch, onPreservesPitchChange }: ControlsProps) {
  return (
    <Bar>
      <Group>
        <PlayButton />
        <PauseButton />
        <StopButton />
      </Group>

      <Time />

      <Group>
        <Label>Speed</Label>
        <PlaybackRateSelect />
      </Group>

      <Group>
        <Label>Preserve pitch</Label>
        <Button $active={preservesPitch} onClick={() => onPreservesPitchChange(true)}>
          On
        </Button>
        <Button $active={!preservesPitch} onClick={() => onPreservesPitchChange(false)}>
          Off
        </Button>
      </Group>
    </Bar>
  );
}
