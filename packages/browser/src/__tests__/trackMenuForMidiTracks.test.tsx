// @vitest-environment jsdom
//
// The track menu holds the render-mode choices (waveform / spectrogram) and
// the spectrogram settings. They apply to audio tracks only: a MIDI track is
// always a piano roll, so its panel has no such menu.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import React from 'react';
import { ThemeProvider } from 'styled-components';
import { defaultTheme } from '@waveform-playlist/ui-components';
import type { TrackKind } from '@waveform-playlist/core';
import { DefaultTrackControls } from '../components/DefaultTrackControls';
import type { SpectrogramIntegration } from '../SpectrogramIntegrationContext';

afterEach(cleanup);

function renderPanel(kind: TrackKind | undefined, spectrogram: SpectrogramIntegration | null) {
  return render(
    <ThemeProvider theme={defaultTheme}>
      <DefaultTrackControls
        trackIndex={0}
        trackId="t1"
        trackState={{ name: 'Track', muted: false, soloed: false, volume: 1, pan: 0 }}
        kind={kind}
        effectiveRenderMode="waveform"
        selectTrack={vi.fn()}
        setTrackMute={vi.fn()}
        setTrackSolo={vi.fn()}
        setTrackVolume={vi.fn()}
        setTrackPan={vi.fn()}
        spectrogram={spectrogram}
        setSettingsModalTrackId={vi.fn()}
        trackReordering={false}
        reorderTrack={vi.fn()}
        trackCount={1}
        disabled={false}
      />
    </ThemeProvider>
  );
}

const integration = {
  renderMenuItems: () => [],
  setTrackRenderMode: vi.fn(),
} as unknown as SpectrogramIntegration;

describe('track menu (render mode and spectrogram settings)', () => {
  it('is shown for an audio track, and when no kind is given', () => {
    renderPanel('audio', integration);
    expect(screen.queryByRole('button', { name: 'Track menu' })).not.toBeNull();
    cleanup();
    renderPanel(undefined, integration);
    expect(screen.queryByRole('button', { name: 'Track menu' })).not.toBeNull();
  });

  it('is not shown for a MIDI track', () => {
    renderPanel('midi', integration);
    expect(screen.queryByRole('button', { name: 'Track menu' })).toBeNull();
    // The rest of the panel is there.
    expect(screen.getByText('Track')).toBeTruthy();
  });

  it('is not shown without the spectrogram integration', () => {
    renderPanel('audio', null);
    expect(screen.queryByRole('button', { name: 'Track menu' })).toBeNull();
  });
});
