// @vitest-environment jsdom
/**
 * The integration hooks' errors name the package to install with the range
 * browser peers on (annotations) or a caret on its version (spectrogram, no
 * peer) (#884).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { installSpecs } from '../../../../scripts/build/install-specs.mjs';
import { useAnnotationIntegration } from '../AnnotationIntegrationContext';
import { useSpectrogramIntegration } from '../SpectrogramIntegrationContext';

const specs = installSpecs('browser', ['@waveform-playlist/spectrogram']);

afterEach(() => vi.restoreAllMocks());

describe('integration hooks outside their provider', () => {
  it('useAnnotationIntegration names annotations with its peer range', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAnnotationIntegration())).toThrow(
      `npm install "${specs['@waveform-playlist/annotations']}"`
    );
  });

  it('useSpectrogramIntegration names spectrogram with a caret on its version', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useSpectrogramIntegration())).toThrow(
      `npm install "${specs['@waveform-playlist/spectrogram']}"`
    );
  });
});
