import type { Meta, StoryObj } from '@storybook/react';
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  VUMeter,
  RecordButton,
  RecordingIndicator,
  MicrophoneSelector,
} from '@waveform-playlist/recording';

/**
 * Recording Components
 *
 * Components for audio recording functionality including
 * VU meters, record buttons, and device selection.
 */

const DemoContainer = styled.div`
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
`;

const DemoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const Label = styled.span`
  font-size: 0.875rem;
  color: #666;
  min-width: 100px;
`;

// Mock microphone devices for demos
const mockDevices = [
  { deviceId: 'default', label: 'Default Microphone' },
  { deviceId: 'device1', label: 'Built-in Microphone' },
  { deviceId: 'device2', label: 'USB Audio Interface' },
  { deviceId: 'device3', label: 'Bluetooth Headset' },
];

const meta: Meta = {
  title: 'Recording/Components',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
# Recording Components

Components for implementing audio recording functionality in waveform-playlist.

## Components

- **VUMeter** - Displays real-time audio input levels with color-coded zones
- **RecordButton** - Toggle button for starting/stopping recording
- **RecordingIndicator** - Shows recording status and duration
- **MicrophoneSelector** - Dropdown for selecting input device

## Usage

\`\`\`tsx
import {
  VUMeter,
  RecordButton,
  RecordingIndicator,
  MicrophoneSelector,
  useMicrophoneAccess,
  useMicrophoneLevel,
  useRecording,
} from '@waveform-playlist/recording';
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;

// VUMeter Stories
export const VUMeterDefault: StoryObj = {
  name: 'VU Meter - Default',
  render: () => (
    <DemoContainer>
      <h3 style={{ margin: '0 0 1rem 0' }}>VU Meter</h3>
      <DemoRow>
        <Label>Low level:</Label>
        <VUMeter level={0.3} />
      </DemoRow>
      <DemoRow>
        <Label>Medium level:</Label>
        <VUMeter level={0.6} />
      </DemoRow>
      <DemoRow>
        <Label>High level:</Label>
        <VUMeter level={0.9} />
      </DemoRow>
    </DemoContainer>
  ),
  parameters: {
    docs: {
      description: {
        story: 'VU Meter displaying different audio levels with color-coded zones (green, yellow, red).',
      },
    },
  },
};

export const VUMeterWithPeak: StoryObj = {
  name: 'VU Meter - With Peak',
  render: () => (
    <DemoContainer>
      <h3 style={{ margin: '0 0 1rem 0' }}>VU Meter with Peak Indicator</h3>
      <DemoRow>
        <Label>With peak:</Label>
        <VUMeter level={0.4} peakLevel={0.7} />
      </DemoRow>
      <DemoRow>
        <Label>Peak at max:</Label>
        <VUMeter level={0.5} peakLevel={0.95} />
      </DemoRow>
    </DemoContainer>
  ),
  parameters: {
    docs: {
      description: {
        story: 'VU Meter showing both current level and peak indicator.',
      },
    },
  },
};

export const VUMeterSizes: StoryObj = {
  name: 'VU Meter - Sizes',
  render: () => (
    <DemoContainer>
      <h3 style={{ margin: '0 0 1rem 0' }}>VU Meter Sizes</h3>
      <DemoRow>
        <Label>Small:</Label>
        <VUMeter level={0.5} width={100} height={12} />
      </DemoRow>
      <DemoRow>
        <Label>Default:</Label>
        <VUMeter level={0.5} width={200} height={20} />
      </DemoRow>
      <DemoRow>
        <Label>Large:</Label>
        <VUMeter level={0.5} width={300} height={30} />
      </DemoRow>
    </DemoContainer>
  ),
  parameters: {
    docs: {
      description: {
        story: 'VU Meter in different sizes.',
      },
    },
  },
};

// Animated VU Meter demo
const AnimatedVUMeterDemo: React.FC = () => {
  const [level, setLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate varying audio levels
      const newLevel = 0.2 + Math.random() * 0.6;
      setLevel(newLevel);
      setPeakLevel(current => Math.max(newLevel, current * 0.98));
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <DemoContainer>
      <h3 style={{ margin: '0 0 1rem 0' }}>Animated VU Meter</h3>
      <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
        Simulating real-time audio input levels
      </p>
      <VUMeter level={level} peakLevel={peakLevel} width={300} height={24} />
    </DemoContainer>
  );
};

export const VUMeterAnimated: StoryObj = {
  name: 'VU Meter - Animated',
  render: () => <AnimatedVUMeterDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Animated VU Meter simulating real-time audio input.',
      },
    },
  },
};

// RecordButton Stories
export const RecordButtonDefault: StoryObj = {
  name: 'Record Button - Default',
  render: () => {
    const [isRecording, setIsRecording] = useState(false);
    return (
      <DemoContainer>
        <h3 style={{ margin: '0 0 1rem 0' }}>Record Button</h3>
        <DemoRow>
          <RecordButton
            isRecording={isRecording}
            onClick={() => setIsRecording(!isRecording)}
          />
          <span style={{ fontSize: '0.875rem', color: '#666' }}>
            {isRecording ? 'Click to stop' : 'Click to start'}
          </span>
        </DemoRow>
      </DemoContainer>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive record button that toggles between record and stop states.',
      },
    },
  },
};

export const RecordButtonStates: StoryObj = {
  name: 'Record Button - States',
  render: () => (
    <DemoContainer>
      <h3 style={{ margin: '0 0 1rem 0' }}>Record Button States</h3>
      <DemoRow>
        <Label>Ready:</Label>
        <RecordButton isRecording={false} onClick={() => {}} />
      </DemoRow>
      <DemoRow>
        <Label>Recording:</Label>
        <RecordButton isRecording={true} onClick={() => {}} />
      </DemoRow>
      <DemoRow>
        <Label>Disabled:</Label>
        <RecordButton isRecording={false} onClick={() => {}} disabled />
      </DemoRow>
    </DemoContainer>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Record button in different states: ready, recording, and disabled.',
      },
    },
  },
};

// RecordingIndicator Stories
export const RecordingIndicatorDefault: StoryObj = {
  name: 'Recording Indicator - Default',
  render: () => (
    <DemoContainer>
      <h3 style={{ margin: '0 0 1rem 0' }}>Recording Indicator</h3>
      <DemoRow>
        <Label>Not recording:</Label>
        <RecordingIndicator isRecording={false} duration={0} />
      </DemoRow>
      <DemoRow>
        <Label>Recording:</Label>
        <RecordingIndicator isRecording={true} duration={45} />
      </DemoRow>
      <DemoRow>
        <Label>Paused:</Label>
        <RecordingIndicator isRecording={true} isPaused={true} duration={45} />
      </DemoRow>
    </DemoContainer>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Recording indicator showing status and duration.',
      },
    },
  },
};

// Animated Recording Indicator
const AnimatedRecordingIndicatorDemo: React.FC = () => {
  const [duration, setDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(true);

  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording]);

  return (
    <DemoContainer>
      <h3 style={{ margin: '0 0 1rem 0' }}>Live Recording Indicator</h3>
      <DemoRow>
        <RecordButton
          isRecording={isRecording}
          onClick={() => setIsRecording(!isRecording)}
        />
        <RecordingIndicator isRecording={isRecording} duration={duration} />
      </DemoRow>
    </DemoContainer>
  );
};

export const RecordingIndicatorAnimated: StoryObj = {
  name: 'Recording Indicator - Animated',
  render: () => <AnimatedRecordingIndicatorDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Live recording indicator with incrementing duration.',
      },
    },
  },
};

// MicrophoneSelector Stories
export const MicrophoneSelectorDefault: StoryObj = {
  name: 'Microphone Selector - Default',
  render: () => {
    const [selected, setSelected] = useState('default');
    return (
      <DemoContainer>
        <h3 style={{ margin: '0 0 1rem 0' }}>Microphone Selector</h3>
        <MicrophoneSelector
          devices={mockDevices}
          selectedDeviceId={selected}
          onDeviceChange={setSelected}
        />
        <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '1rem' }}>
          Selected: {selected}
        </p>
      </DemoContainer>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Dropdown for selecting microphone input device.',
      },
    },
  },
};

export const MicrophoneSelectorStates: StoryObj = {
  name: 'Microphone Selector - States',
  render: () => (
    <DemoContainer>
      <h3 style={{ margin: '0 0 1rem 0' }}>Microphone Selector States</h3>
      <DemoRow style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <Label>With devices:</Label>
          <MicrophoneSelector
            devices={mockDevices}
            selectedDeviceId="default"
            onDeviceChange={() => {}}
          />
        </div>
        <div>
          <Label>Disabled:</Label>
          <MicrophoneSelector
            devices={mockDevices}
            selectedDeviceId="default"
            onDeviceChange={() => {}}
            disabled
          />
        </div>
        <div>
          <Label>No devices:</Label>
          <MicrophoneSelector
            devices={[]}
            onDeviceChange={() => {}}
          />
        </div>
      </DemoRow>
    </DemoContainer>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Microphone selector in different states.',
      },
    },
  },
};

// Complete Recording Controls Demo
const CompleteRecordingDemo: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState('default');
  const [level, setLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);

  useEffect(() => {
    if (!isRecording) return;

    const durationInterval = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);

    return () => clearInterval(durationInterval);
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording) {
      setLevel(0);
      setPeakLevel(0);
      return;
    }

    const levelInterval = setInterval(() => {
      const newLevel = 0.2 + Math.random() * 0.6;
      setLevel(newLevel);
      setPeakLevel(current => Math.max(newLevel, current * 0.98));
    }, 50);

    return () => clearInterval(levelInterval);
  }, [isRecording]);

  const handleRecordClick = () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      setDuration(0);
      setIsRecording(true);
    }
  };

  return (
    <DemoContainer>
      <h3 style={{ margin: '0 0 1rem 0' }}>Complete Recording Controls</h3>

      <DemoRow>
        <MicrophoneSelector
          devices={mockDevices}
          selectedDeviceId={selectedDevice}
          onDeviceChange={setSelectedDevice}
          disabled={isRecording}
        />
      </DemoRow>

      <DemoRow>
        <RecordButton
          isRecording={isRecording}
          onClick={handleRecordClick}
        />
        <RecordingIndicator
          isRecording={isRecording}
          duration={duration}
        />
      </DemoRow>

      <DemoRow>
        <Label>Input Level:</Label>
        <VUMeter level={level} peakLevel={peakLevel} width={250} height={20} />
      </DemoRow>
    </DemoContainer>
  );
};

export const CompleteRecordingControls: StoryObj = {
  name: 'Complete Recording Controls',
  render: () => <CompleteRecordingDemo />,
  parameters: {
    docs: {
      description: {
        story: 'All recording components working together in a complete recording interface.',
      },
    },
  },
};
