// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';

const panelEl = () => {
  const el = document.createElement('div');
  el.className = 'generic-panel';
  return el;
};
const createWamParameterPanel = vi.fn(async (..._args: unknown[]) => panelEl());
vi.mock('@dawcore/wam', () => ({
  createWamParameterPanel: (...a: unknown[]) => createWamParameterPanel(...a),
  ensureWamHost: vi.fn(),
  createWamInstance: vi.fn(),
  createWamInstanceFromFactory: vi.fn(),
  loadWamFactory: vi.fn(),
  cloneInstanceInto: vi.fn(),
  createParameterPanel: vi.fn(),
  fetchWamLibrary: vi.fn(),
  fetchWamDescriptor: vi.fn(),
  createWamTransportBridge: vi.fn(),
}));

import { WamEffectGui } from '../components/WamEffectGui';
import type { WamPluginInstance } from '@dawcore/wam';

describe('WamEffectGui', () => {
  it('mounts the plugin GUI and destroys it on unmount', async () => {
    const gui = document.createElement('div');
    gui.className = 'plugin-gui';
    const destroyGui = vi.fn();
    const plugin = {
      audioNode: {},
      createGui: vi.fn(async () => gui),
      destroyGui,
      destroy: vi.fn(),
    } as unknown as WamPluginInstance;

    const { container, unmount } = render(<WamEffectGui plugin={plugin} />);
    await waitFor(() => expect(container.querySelector('.plugin-gui')).not.toBeNull());
    unmount();
    expect(destroyGui).toHaveBeenCalledWith(gui);
  });

  it('does not throw when destroyGui throws during unmount cleanup', async () => {
    const gui = document.createElement('div');
    gui.className = 'plugin-gui';
    const destroyGui = vi.fn(() => {
      throw new Error('boom');
    });
    const plugin = {
      audioNode: {},
      createGui: vi.fn(async () => gui),
      destroyGui,
      destroy: vi.fn(),
    } as unknown as WamPluginInstance;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container, unmount } = render(<WamEffectGui plugin={plugin} />);
    await waitFor(() => expect(container.querySelector('.plugin-gui')).not.toBeNull());
    expect(() => unmount()).not.toThrow();
    expect(destroyGui).toHaveBeenCalledWith(gui);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('falls back to the generic parameter panel for headless plugins', async () => {
    const plugin = { audioNode: {}, destroy: vi.fn() } as unknown as WamPluginInstance;
    const { container } = render(<WamEffectGui plugin={plugin} />);
    await waitFor(() => expect(container.querySelector('.generic-panel')).not.toBeNull());
    expect(createWamParameterPanel).toHaveBeenCalled();
  });

  it('renders nothing without a plugin', () => {
    const { container } = render(<WamEffectGui plugin={undefined} />);
    expect(container.querySelector('.wam-effect-gui')?.children.length ?? 0).toBe(0);
  });
});
