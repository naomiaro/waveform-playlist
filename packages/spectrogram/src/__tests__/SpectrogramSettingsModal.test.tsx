import { describe, it, expect, vi, beforeAll, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
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
    sampleRate?: number;
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
      sampleRate={overrides.sampleRate}
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

// #814: Apply sends only what the user changed; every other field of the
// config, and the colour map, go back as they came in.
describe('SpectrogramSettingsModal: Apply changes only what was edited (#814)', () => {
  const apply = () => fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  const maxFrequency = () => screen.getByLabelText('Max Frequency (Hz)') as HTMLInputElement;

  it('Apply with no edit gives back the config it was given, fields the form does not show included', () => {
    const config: SpectrogramConfig = {
      fftSize: 1024,
      alpha: 0.6,
      labels: true,
      labelsColor: '#abcdef',
      labelsBackground: 'rgba(0, 0, 0, 0.3)',
    };
    const { onApply } = renderModal({ config, colorMap: 'inferno' });
    apply();
    expect(onApply).toHaveBeenCalledWith(config, 'inferno');
  });

  it('an edit is added to the config, and nothing else is written', () => {
    const config: SpectrogramConfig = { alpha: 0.6, labelsColor: '#abcdef' };
    const { onApply, numbers } = renderModal({ config });
    fireEvent.change(numbers()[3], { target: { value: '35' } }); // gain
    apply();
    expect(onApply.mock.lastCall?.[0]).toEqual({ alpha: 0.6, labelsColor: '#abcdef', gainDb: 35 });
  });

  it('with no maxFrequency, the field shows half the sample rate and Apply leaves it unset', () => {
    const { onApply } = renderModal({ config: {}, sampleRate: 48000 });
    expect(maxFrequency().value).toBe('24000');
    expect(maxFrequency().max).toBe('24000');
    apply();
    expect(onApply.mock.lastCall?.[0]).toEqual({});
  });

  it('with no maxFrequency and no sample rate, the field is empty', () => {
    renderModal({ config: {} });
    expect(maxFrequency().value).toBe('');
  });

  it('a typed maxFrequency is written; an emptied one goes back to the default', () => {
    const { onApply } = renderModal({ config: { maxFrequency: 18000 }, sampleRate: 48000 });
    fireEvent.change(maxFrequency(), { target: { value: '12000' } });
    apply();
    expect(onApply.mock.lastCall?.[0]).toEqual({ maxFrequency: 12000 });

    cleanup();
    const second = renderModal({ config: { maxFrequency: 18000 }, sampleRate: 48000 });
    fireEvent.change(maxFrequency(), { target: { value: '' } });
    expect(maxFrequency().value).toBe('');
    apply();
    expect(second.onApply.mock.lastCall?.[0]).toEqual({ maxFrequency: undefined });
  });

  it('a custom colour map shows as custom and is kept by Apply', () => {
    const custom: ColorMapValue = [
      [0, 0, 0],
      [255, 255, 255],
    ];
    const { onApply, selects } = renderModal({ colorMap: custom });
    const colorMap = selects()[5];
    expect(colorMap.selectedOptions[0].textContent).toBe('custom');
    apply();
    expect(onApply.mock.lastCall?.[1]).toBe(custom);
  });

  it('picking a named colour map replaces a custom one', () => {
    const { onApply, selects } = renderModal({ colorMap: [[0, 0, 0]] });
    fireEvent.change(selects()[5], { target: { value: 'roseus' } });
    apply();
    expect(onApply.mock.lastCall?.[1]).toBe('roseus');
  });

  it('offers no custom option for a named colour map', () => {
    const { selects } = renderModal({ colorMap: 'magma' });
    const texts = Array.from(selects()[5].options, (o) => o.textContent);
    expect(texts).not.toContain('custom');
  });

  it('the Apply button takes its colours from the theme', () => {
    render(
      <ThemeProvider
        theme={{
          buttonBackground: 'rgb(1, 2, 3)',
          buttonText: 'rgb(4, 5, 6)',
          buttonBorder: 'rgb(7, 8, 9)',
        }}
      >
        <SpectrogramSettingsModal
          open
          onClose={vi.fn()}
          config={{}}
          colorMap="viridis"
          onApply={vi.fn()}
        />
      </ThemeProvider>
    );
    const style = getComputedStyle(screen.getByRole('button', { name: 'Apply' }));
    expect(style.backgroundColor).toBe('rgb(1, 2, 3)');
    expect(style.color).toBe('rgb(4, 5, 6)');
    expect(style.borderColor).toBe('rgb(7, 8, 9)');
  });
});
