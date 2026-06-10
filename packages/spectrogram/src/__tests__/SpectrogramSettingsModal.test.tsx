import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { SpectrogramConfig, ColorMapValue } from '@waveform-playlist/core';
import { SpectrogramSettingsModal } from '../components/SpectrogramSettingsModal';

// jsdom historically lacked <dialog> showModal/close. Polyfill only when absent
// so the open/close effect doesn't throw. The form content renders regardless
// of actual modal open-state, so assertions hold either way.
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    };
  }
});

afterEach(() => cleanup());

const baseConfig: SpectrogramConfig = {
  fftSize: 4096,
  windowFunction: 'hamming',
  frequencyScale: 'linear',
  minFrequency: 100,
  maxFrequency: 18000,
  gainDb: 30,
  rangeDb: 70,
  zeroPaddingFactor: 4,
  hopSize: 1024,
  labels: true,
};

function renderModal(
  overrides: {
    open?: boolean;
    config?: SpectrogramConfig;
    colorMap?: ColorMapValue;
    onApply?: ReturnType<typeof vi.fn>;
    onClose?: ReturnType<typeof vi.fn>;
  } = {}
) {
  const onApply = overrides.onApply ?? vi.fn();
  const onClose = overrides.onClose ?? vi.fn();
  const utils = render(
    <SpectrogramSettingsModal
      open={overrides.open ?? true}
      onClose={onClose}
      config={overrides.config ?? baseConfig}
      colorMap={overrides.colorMap ?? 'magma'}
      onApply={onApply}
    />
  );
  // DOM order: [fftSize, hopSize, zeroPadding, windowFn, freqScale, colorMap]
  const selects = () => screen.getAllByRole('combobox') as HTMLSelectElement[];
  // DOM order: [minFreq, maxFreq, rangeDb, gainDb]
  const numbers = () => screen.getAllByRole('spinbutton') as HTMLInputElement[];
  return { onApply, onClose, selects, numbers, ...utils };
}

describe('SpectrogramSettingsModal', () => {
  it('initialises form fields from the config and color map', () => {
    const { selects, numbers } = renderModal();
    const [fft, hop, zeroPad, windowFn, freqScale, colorMap] = selects();
    expect(fft.value).toBe('4096');
    expect(hop.value).toBe('1024');
    expect(zeroPad.value).toBe('4');
    expect(windowFn.value).toBe('hamming');
    expect(freqScale.value).toBe('linear');
    expect(colorMap.value).toBe('magma');

    const [minFreq, maxFreq, rangeDb, gainDb] = numbers();
    expect(minFreq.value).toBe('100');
    expect(maxFreq.value).toBe('18000');
    expect(rangeDb.value).toBe('70');
    expect(gainDb.value).toBe('30');

    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });

  it('updates hop size when the FFT size changes', () => {
    const { selects } = renderModal();
    fireEvent.change(selects()[0], { target: { value: '8192' } });
    // hop size resets to fftSize / 4 = 2048
    expect(selects()[1].value).toBe('2048');
  });

  it('Apply emits the edited config plus color map, then closes', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    const { selects } = renderModal({ onApply, onClose });

    fireEvent.change(selects()[3], { target: { value: 'blackman' } }); // window function

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    const [emittedConfig, emittedColorMap] = onApply.mock.calls[0];
    expect(emittedConfig).toMatchObject({
      fftSize: 4096,
      windowFunction: 'blackman',
      frequencyScale: 'linear',
      minFrequency: 100,
      maxFrequency: 18000,
      gainDb: 30,
      rangeDb: 70,
      zeroPaddingFactor: 4,
      hopSize: 1024,
      labels: true,
    });
    expect(emittedColorMap).toBe('magma');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Cancel closes without applying', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    renderModal({ onApply, onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('re-syncs local form state when the config prop changes', () => {
    const { selects, rerender } = renderModal();
    expect(selects()[0].value).toBe('4096');

    rerender(
      <SpectrogramSettingsModal
        open
        onClose={vi.fn()}
        config={{ ...baseConfig, fftSize: 512, windowFunction: 'hann' }}
        colorMap="viridis"
        onApply={vi.fn()}
      />
    );

    expect(selects()[0].value).toBe('512');
    expect(selects()[3].value).toBe('hann');
    expect((selects()[5] as HTMLSelectElement).value).toBe('viridis');
  });
});
