import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SpectrogramMenuItems } from '../components/SpectrogramMenuItems';

afterEach(() => cleanup());

function setup(overrides: Partial<Parameters<typeof SpectrogramMenuItems>[0]> = {}) {
  const props = {
    renderMode: 'waveform' as const,
    onRenderModeChange: vi.fn(),
    onOpenSettings: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  const items = SpectrogramMenuItems(props);
  // Render each item's content so we can interact with it.
  render(
    <div>
      {items.map((item) => (
        <React.Fragment key={item.id}>{item.content}</React.Fragment>
      ))}
    </div>
  );
  return { props, items };
}

describe('SpectrogramMenuItems', () => {
  it('returns a display item and a settings item', () => {
    const { items } = setup();
    expect(items.map((i) => i.id)).toEqual(['spectrogram-display', 'spectrogram-settings']);
  });

  it('checks the radio matching the current render mode', () => {
    setup({ renderMode: 'spectrogram' });
    const spectrogram = screen.getByLabelText('Spectrogram') as HTMLInputElement;
    const waveform = screen.getByLabelText('Waveform') as HTMLInputElement;
    expect(spectrogram.checked).toBe(true);
    expect(waveform.checked).toBe(false);
  });

  it('emits the selected mode and closes the menu on change', () => {
    const { props } = setup({ renderMode: 'waveform' });
    fireEvent.click(screen.getByLabelText('Both'));
    expect(props.onRenderModeChange).toHaveBeenCalledWith('both');
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('opens settings (after closing the menu) from the settings button', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: /spectrogram settings/i }));
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.onOpenSettings).toHaveBeenCalledOnce();
  });

  it('does not require an onClose handler', () => {
    const onRenderModeChange = vi.fn();
    const items = SpectrogramMenuItems({
      renderMode: 'waveform',
      onRenderModeChange,
      onOpenSettings: vi.fn(),
    });
    render(
      <div>
        {items.map((i) => (
          <React.Fragment key={i.id}>{i.content}</React.Fragment>
        ))}
      </div>
    );
    expect(() => fireEvent.click(screen.getByLabelText('Spectrogram'))).not.toThrow();
    expect(onRenderModeChange).toHaveBeenCalledWith('spectrogram');
  });
});
