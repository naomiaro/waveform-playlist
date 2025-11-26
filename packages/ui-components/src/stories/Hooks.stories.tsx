import type { Meta, StoryObj } from '@storybook/react';
import React, { useState, useEffect } from 'react';
import {
  WaveformPlaylistProvider,
  useWaveformPlaylist,
  useZoomControls,
  useTimeFormat,
  useKeyboardShortcuts,
  getShortcutLabel,
} from '@waveform-playlist/browser';
import type { KeyboardShortcut } from '@waveform-playlist/browser';
import { BaseButton, BaseSlider, BaseSelect } from '../styled';

/**
 * Hook Testing Harness
 *
 * A component that uses hooks and exposes their state for testing/visualization.
 * This pattern allows us to test hooks in Storybook by creating wrapper components.
 */

// useZoomControls hook demo
const ZOOM_LEVELS = [256, 512, 1024, 2048, 4096];

const ZoomControlsDemo: React.FC = () => {
  const { samplesPerPixel, zoomIn, zoomOut, canZoomIn, canZoomOut } = useZoomControls({
    initialSamplesPerPixel: 1024,
    zoomLevels: ZOOM_LEVELS,
  });

  return (
    <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>useZoomControls</h3>
      <div style={{ marginBottom: '1rem' }}>
        <strong>Current:</strong> {samplesPerPixel} samples/pixel
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <BaseButton onClick={zoomIn} disabled={!canZoomIn}>Zoom In</BaseButton>
        <BaseButton onClick={zoomOut} disabled={!canZoomOut}>Zoom Out</BaseButton>
      </div>
      <div style={{ fontSize: '0.875rem', color: '#666' }}>
        <div>Can zoom in: {canZoomIn ? 'Yes' : 'No'}</div>
        <div>Can zoom out: {canZoomOut ? 'Yes' : 'No'}</div>
        <div>Available levels: {ZOOM_LEVELS.join(', ')}</div>
      </div>
    </div>
  );
};

// useTimeFormat hook demo
const TimeFormatDemo: React.FC = () => {
  const { timeFormat, setTimeFormat, formatTime } = useTimeFormat();
  const [testSeconds, setTestSeconds] = useState(125.5);

  return (
    <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>useTimeFormat</h3>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Format:</label>
        <BaseSelect
          value={timeFormat}
          onChange={(e) => setTimeFormat(e.target.value as any)}
          style={{ width: '200px' }}
        >
          <option value="seconds">Seconds</option>
          <option value="thousandths">Thousandths</option>
          <option value="hh:mm:ss">HH:MM:SS</option>
          <option value="hh:mm:ss.u">HH:MM:SS.U</option>
          <option value="hh:mm:ss.uu">HH:MM:SS.UU</option>
          <option value="hh:mm:ss.uuu">HH:MM:SS.UUU</option>
        </BaseSelect>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Test Value (seconds):</label>
        <BaseSlider
          min={0}
          max={3600}
          step={0.1}
          value={testSeconds}
          onChange={(e) => setTestSeconds(Number(e.target.value))}
          style={{ width: '200px' }}
        />
        <span style={{ marginLeft: '0.5rem' }}>{testSeconds}s</span>
      </div>
      <div>
        <strong>Formatted:</strong> {formatTime(testSeconds)}
      </div>
    </div>
  );
};

// useMasterVolume via context demo
// Note: useMasterVolume is an internal hook used by WaveformPlaylistProvider.
// Components should access masterVolume via useWaveformPlaylist context.
const MasterVolumeDemo: React.FC = () => {
  const { masterVolume, setMasterVolume } = useWaveformPlaylist();
  const [muted, setMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(masterVolume);

  const toggleMute = () => {
    if (muted) {
      setMasterVolume(previousVolume);
      setMuted(false);
    } else {
      setPreviousVolume(masterVolume);
      setMasterVolume(0);
      setMuted(true);
    }
  };

  return (
    <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>useWaveformPlaylist (masterVolume)</h3>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Volume: {Math.round(masterVolume * 100)}%
        </label>
        <BaseSlider
          min={0}
          max={1}
          step={0.01}
          value={masterVolume}
          onChange={(e) => setMasterVolume(Number(e.target.value))}
          style={{ width: '200px' }}
        />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <BaseButton onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</BaseButton>
        <span style={{ color: muted ? 'red' : 'green' }}>
          {muted ? '🔇 Muted' : '🔊 Active'}
        </span>
      </div>
    </div>
  );
};

// useKeyboardShortcuts hook demo
const KeyboardShortcutsDemo: React.FC = () => {
  const [lastAction, setLastAction] = useState<string>('None');
  const [actionCount, setActionCount] = useState(0);

  const shortcuts: KeyboardShortcut[] = [
    {
      key: ' ',
      action: () => {
        setLastAction('Play/Pause (Space)');
        setActionCount(c => c + 1);
      },
      description: 'Play/Pause',
      preventDefault: true,
    },
    {
      key: 's',
      action: () => {
        setLastAction('Split (S)');
        setActionCount(c => c + 1);
      },
      description: 'Split clip at cursor',
      preventDefault: true,
    },
    {
      key: 'Delete',
      action: () => {
        setLastAction('Delete (Delete)');
        setActionCount(c => c + 1);
      },
      description: 'Delete selected',
      preventDefault: true,
    },
    {
      key: 'z',
      metaKey: true,
      action: () => {
        setLastAction('Undo (Cmd+Z)');
        setActionCount(c => c + 1);
      },
      description: 'Undo',
      preventDefault: true,
    },
    {
      key: 'z',
      metaKey: true,
      shiftKey: true,
      action: () => {
        setLastAction('Redo (Cmd+Shift+Z)');
        setActionCount(c => c + 1);
      },
      description: 'Redo',
      preventDefault: true,
    },
  ];

  useKeyboardShortcuts({ shortcuts, enabled: true });

  return (
    <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>useKeyboardShortcuts</h3>
      <div style={{ marginBottom: '1rem' }}>
        <strong>Last Action:</strong> {lastAction}
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <strong>Total Actions:</strong> {actionCount}
      </div>
      <div style={{ fontSize: '0.875rem', color: '#666' }}>
        <strong>Available Shortcuts:</strong>
        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
          {shortcuts.map((s, i) => (
            <li key={i}>
              <code>{getShortcutLabel(s)}</code> - {s.description}
            </li>
          ))}
        </ul>
        <p style={{ fontStyle: 'italic' }}>
          Click in this panel and press keyboard shortcuts to test.
        </p>
      </div>
    </div>
  );
};

// Provider wrapper for hooks that need context
const HookDemoWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <WaveformPlaylistProvider tracks={[]} samplesPerPixel={1024}>
    {children}
  </WaveformPlaylistProvider>
);

const meta: Meta = {
  title: 'Browser/Hooks',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
# Hook Testing in Storybook

These stories demonstrate how to test and visualize custom React hooks.

## Pattern
1. Create a wrapper component that uses the hook
2. Expose hook state and actions via UI
3. Use Storybook's interaction testing for automated tests

## Available Hooks

### Demoed in Storybook
- \`useZoomControls\` - Manage zoom levels and navigation
- \`useTimeFormat\` - Format and parse time values
- \`useMasterVolume\` - Control master audio volume (via context)
- \`useKeyboardShortcuts\` - Flexible keyboard shortcut system

### Require Full Context (not demoed)
- \`useAudioTracks\` - Load audio files
- \`useClipDragHandlers\` - Drag-to-move and boundary trimming
- \`useClipSplitting\` - Split clips at cursor position
- \`useAnnotationDragHandlers\` - Drag annotation boundaries
- \`useAnnotationKeyboardControls\` - Keyboard navigation for annotations
- \`useDragSensors\` - Configure @dnd-kit sensors
- \`useIntegratedRecording\` - Recording with auto-add to playlist
- \`useDynamicEffects\` - Master effects chain (20 effects with runtime toggle)
- \`useTrackDynamicEffects\` - Per-track effect management
- \`useExportWav\` - Export playlist to WAV file
- \`useMasterAnalyser\` - Master output analyser node for visualization
        `,
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;

export const ZoomControls: StoryObj = {
  render: () => (
    <HookDemoWrapper>
      <ZoomControlsDemo />
    </HookDemoWrapper>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The `useZoomControls` hook manages zoom levels for waveform display.',
      },
    },
  },
};

export const TimeFormat: StoryObj = {
  render: () => (
    <HookDemoWrapper>
      <TimeFormatDemo />
    </HookDemoWrapper>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The `useTimeFormat` hook formats time values for display and parses user input.',
      },
    },
  },
};

export const MasterVolume: StoryObj = {
  render: () => (
    <HookDemoWrapper>
      <MasterVolumeDemo />
    </HookDemoWrapper>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The `useMasterVolume` hook controls the master audio output volume.',
      },
    },
  },
};

export const KeyboardShortcuts: StoryObj = {
  render: () => <KeyboardShortcutsDemo />,
  parameters: {
    docs: {
      description: {
        story: 'The `useKeyboardShortcuts` hook provides a flexible system for handling keyboard shortcuts with modifier key support.',
      },
    },
  },
};

export const AllHooks: StoryObj = {
  render: () => (
    <HookDemoWrapper>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <ZoomControlsDemo />
        <TimeFormatDemo />
        <MasterVolumeDemo />
        <KeyboardShortcutsDemo />
      </div>
    </HookDemoWrapper>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All hook demos displayed together for comparison.',
      },
    },
  },
};
