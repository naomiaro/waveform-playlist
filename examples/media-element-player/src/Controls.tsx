import { useEffect, useRef } from 'react';
import styled from 'styled-components';
import {
  useMediaElementAnimation,
  useMediaElementState,
  useMediaElementControls,
  useMediaElementData,
} from '@waveform-playlist/browser';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

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

const Time = styled.span`
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
  const { isPlaying, currentTimeRef } = useMediaElementAnimation();
  const { playbackRate } = useMediaElementState();
  const { play, pause, stop, setPlaybackRate } = useMediaElementControls();
  const { duration } = useMediaElementData();

  // `currentTime` (React state) only updates on pause/stop/seek/end. For a smooth
  // readout during playback, drive a DOM ref from `currentTimeRef` via rAF.
  const timeRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (timeRef.current) {
        timeRef.current.textContent = `${formatTime(currentTimeRef.current ?? 0)} / ${formatTime(duration)}`;
      }
      if (isPlaying) raf = requestAnimationFrame(tick);
    };
    if (isPlaying) raf = requestAnimationFrame(tick);
    else tick();
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, currentTimeRef, duration]);

  return (
    <Bar>
      <Group>
        <Button onClick={() => play()} disabled={isPlaying}>
          ▶ Play
        </Button>
        <Button onClick={() => pause()} disabled={!isPlaying}>
          ⏸ Pause
        </Button>
        <Button onClick={() => stop()}>⏹ Stop</Button>
      </Group>

      <Time ref={timeRef}>
        {formatTime(currentTimeRef.current ?? 0)} / {formatTime(duration)}
      </Time>

      <Group>
        <Label>Speed</Label>
        {SPEEDS.map((rate) => (
          <Button key={rate} $active={playbackRate === rate} onClick={() => setPlaybackRate(rate)}>
            {rate}×
          </Button>
        ))}
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
