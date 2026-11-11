import { describe, it, expect, vi, beforeAll, afterEach, type Mock } from 'vitest';
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
    onApply?: Mock<(config: SpectrogramConfig, colorMap: ColorMapValue) => void>;
    onClose?: Mock<() => void>;
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

  it('keeps unapplied edits when re-rendered with an equal but new config object', () => {
    const { selects, rerender } = renderModal({ config: {} });
    fireEvent.change(selects()[0], { target: { value: '8192' } });

    rerender(
      <SpectrogramSettingsModal
        open
        onClose={vi.fn()}
        config={{}}
        colorMap="magma"
        onApply={vi.fn()}
      />
    );

    expect(selects()[0].value).toBe('8192');
  });

  it('starts from the current props each time it opens', () => {
    const { selects, rerender } = renderModal();
    const modal = (open: boolean, config: SpectrogramConfig, colorMap: ColorMapValue) => (
      <SpectrogramSettingsModal
        open={open}
        onClose={vi.fn()}
        config={config}
        colorMap={colorMap}
        onApply={vi.fn()}
      />
    );

    // An abandoned edit does not survive a close and reopen.
    fireEvent.change(selects()[0], { target: { value: '8192' } });
    rerender(modal(false, baseConfig, 'magma'));
    rerender(modal(true, baseConfig, 'magma'));
    expect(selects()[0].value).toBe('4096');

    // Reopened for another track: the form shows that track's settings.
    rerender(modal(false, baseConfig, 'magma'));
    rerender(modal(true, { ...baseConfig, fftSize: 512, windowFunction: 'hann' }, 'viridis'));
    expect(selects()[0].value).toBe('512');
    expect(selects()[3].value).toBe('hann');
    expect(selects()[5].value).toBe('viridis');
  });

  it('renders no form controls while closed', () => {
    renderModal({ open: false });
    expect(screen.queryAllByRole('combobox', { hidden: true })).toHaveLength(0);
  });

  it('keeps one close listener across onClose identity changes and calls the latest', () => {
    const add = vi.spyOn(HTMLDialogElement.prototype, 'addEventListener');
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender, container } = renderModal({ onClose: first });
    // React attaches its own `close` listener to a <dialog>, so compare counts
    // before and after the re-render instead of expecting exactly one.
    const closeListeners = () => add.mock.calls.filter(([type]) => type === 'close').length;
    const afterMount = closeListeners();
    expect(afterMount).toBeGreaterThan(0);
    rerender(
      <SpectrogramSettingsModal
        open
        onClose={latest}
        config={baseConfig}
        colorMap="magma"
        onApply={vi.fn()}
      />
    );

    expect(closeListeners()).toBe(afterMount);

    // Native close (Escape)
    container.querySelector('dialog')!.dispatchEvent(new Event('close'));
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
    add.mockRestore();
  });

  it('labels every control and names the dialog', () => {
    renderModal();
    for (const name of [
      'FFT Size',
      'Hop Size',
      'Zero Padding',
      'Window Function',
      'Frequency Scale',
      'Color Map',
      'Min Frequency (Hz)',
      'Max Frequency (Hz)',
      'Range (dB)',
      'Gain (dB)',
      'Show Frequency Labels',
    ]) {
      expect(screen.getByLabelText(name)).toBeDefined();
    }
    expect(screen.getByRole('dialog', { name: 'Spectrogram Settings' })).toBeDefined();
  });
});
