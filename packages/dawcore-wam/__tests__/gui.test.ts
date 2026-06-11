// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createParameterPanel, createWamParameterPanel } from '../src/gui';

afterEach(() => {
  vi.restoreAllMocks();
});

function slidersOf(panel: HTMLElement): HTMLInputElement[] {
  return [...panel.querySelectorAll('input.daw-param-slider')] as HTMLInputElement[];
}

function setSlider(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('createParameterPanel', () => {
  it('renders one range input per parameter with min/max/step/value', () => {
    const panel = createParameterPanel(
      [
        { id: 'gain', min: 0, max: 2, step: 0.01, value: 1 },
        { id: 'frequency', min: 20, max: 20000, step: 1, value: 1000, unit: 'Hz' },
      ],
      () => {}
    );

    const sliders = slidersOf(panel);
    expect(sliders).toHaveLength(2);
    expect(sliders[0].type).toBe('range');
    expect(sliders[0].getAttribute('min')).toBe('0');
    expect(sliders[0].getAttribute('max')).toBe('2');
    expect(sliders[0].getAttribute('step')).toBe('0.01');
    expect(sliders[0].value).toBe('1');
    expect(sliders[0].getAttribute('data-param-id')).toBe('gain');
    expect(sliders[1].getAttribute('data-param-id')).toBe('frequency');
  });

  it('labels rows with label when present, falling back to id', () => {
    const panel = createParameterPanel(
      [
        { id: 'q', label: 'Resonance', min: 0.1, max: 20 },
        { id: 'cutoff', min: 20, max: 20000 },
      ],
      () => {}
    );

    const names = [...panel.querySelectorAll('.daw-param-name')].map((el) => el.textContent);
    expect(names).toEqual(['Resonance', 'cutoff']);
  });

  it('shows the current value with its unit in the readout', () => {
    const panel = createParameterPanel(
      [{ id: 'frequency', min: 20, max: 20000, value: 1000, unit: 'Hz' }],
      () => {}
    );

    expect(panel.querySelector('.daw-param-value')?.textContent).toBe('1000 Hz');
  });

  it('fires onChange with the parsed numeric value and updates the readout', () => {
    const onChange = vi.fn();
    const panel = createParameterPanel(
      [{ id: 'gain', min: 0, max: 2, step: 0.01, value: 1 }],
      onChange
    );

    setSlider(slidersOf(panel)[0], '1.5');

    expect(onChange).toHaveBeenCalledWith('gain', 1.5);
    expect(panel.querySelector('.daw-param-value')?.textContent).toBe('1.5');
  });

  it('uses step="any" when no step is provided', () => {
    const panel = createParameterPanel([{ id: 'pan', min: -1, max: 1 }], () => {});
    expect(slidersOf(panel)[0].getAttribute('step')).toBe('any');
  });

  it('clamps the initial value into [min, max] and defaults a missing value to min', () => {
    const panel = createParameterPanel(
      [
        { id: 'over', min: 0, max: 1, value: 5 },
        { id: 'missing', min: 0.25, max: 1 },
      ],
      () => {}
    );

    const sliders = slidersOf(panel);
    expect(sliders[0].value).toBe('1');
    expect(sliders[1].value).toBe('0.25');
  });

  it('skips malformed entries with a [waveform-playlist] warning, keeping valid ones', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const panel = createParameterPanel(
      [
        { id: '', min: 0, max: 1 },
        { id: 'bad-range', min: 1, max: 1 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'nan', min: Number.NaN, max: 1 } as any,
        { id: 'ok', min: 0, max: 1 },
      ],
      () => {}
    );

    expect(slidersOf(panel)).toHaveLength(1);
    expect(slidersOf(panel)[0].getAttribute('data-param-id')).toBe('ok');
    expect(warn).toHaveBeenCalledTimes(3);
    expect(warn.mock.calls[0][0]).toContain('[waveform-playlist]');
  });

  it('renders an empty-state message when there are no usable parameters', () => {
    const panel = createParameterPanel([], () => {});

    expect(slidersOf(panel)).toHaveLength(0);
    expect(panel.querySelector('.daw-param-panel-empty')?.textContent).toMatch(/no.*parameters/i);
  });

  it('throws on non-array params and non-function onChange', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => createParameterPanel(null as any, () => {})).toThrow(/\[waveform-playlist\]/);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => createParameterPanel([], null as any)).toThrow(/\[waveform-playlist\]/);
  });

  it('is themable: --daw-* var() fallbacks plus stable class names for external styling', () => {
    const panel = createParameterPanel([{ id: 'gain', min: 0, max: 2 }], () => {});

    // happy-dom strips var() from known color properties (color/background),
    // so assert the slider accent (passed through) + the class hooks; the
    // panel's color/background var(--daw-*) fallbacks are browser-verified.
    expect(panel.className).toBe('daw-param-panel');
    expect(panel.querySelector('.daw-param-row')).not.toBeNull();
    expect(panel.querySelector('.daw-param-name')).not.toBeNull();
    expect(panel.querySelector('.daw-param-value')).not.toBeNull();
    expect(slidersOf(panel)[0].style.accentColor).toContain('--daw-wave-color');
  });
});

describe('createWamParameterPanel', () => {
  function makeNode(info: unknown) {
    return {
      getParameterInfo: vi.fn().mockResolvedValue(info),
      setParameterValues: vi.fn().mockResolvedValue(undefined),
    };
  }

  it('renders sliders from WamParameterInfo metadata', async () => {
    const node = makeNode({
      cutoff: {
        id: 'cutoff',
        label: 'Cutoff',
        minValue: 20,
        maxValue: 20000,
        defaultValue: 1000,
        discreteStep: 1,
        units: 'Hz',
      },
      resonance: { id: 'resonance', minValue: 0, maxValue: 10, defaultValue: 0.7 },
    });

    const panel = await createWamParameterPanel(node);

    expect(node.getParameterInfo).toHaveBeenCalledTimes(1);
    const sliders = slidersOf(panel);
    expect(sliders).toHaveLength(2);
    expect(sliders[0].getAttribute('data-param-id')).toBe('cutoff');
    expect(sliders[0].getAttribute('min')).toBe('20');
    expect(sliders[0].getAttribute('max')).toBe('20000');
    expect(sliders[0].getAttribute('step')).toBe('1');
    expect(sliders[0].value).toBe('1000');
    expect(panel.querySelectorAll('.daw-param-name')[0].textContent).toBe('Cutoff');
    expect(panel.querySelectorAll('.daw-param-value')[0].textContent).toBe('1000 Hz');
  });

  it('wires slider edits to setParameterValues by default', async () => {
    const node = makeNode({ gain: { id: 'gain', minValue: 0, maxValue: 2, defaultValue: 1 } });
    const panel = await createWamParameterPanel(node);

    setSlider(slidersOf(panel)[0], '0.5');

    expect(node.setParameterValues).toHaveBeenCalledWith({
      gain: { id: 'gain', value: 0.5, normalized: false },
    });
  });

  it('warns (no unhandled rejection) when setParameterValues rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const node = makeNode({ gain: { id: 'gain', minValue: 0, maxValue: 2 } });
    node.setParameterValues.mockRejectedValueOnce(new Error('param refused'));
    const panel = await createWamParameterPanel(node);

    setSlider(slidersOf(panel)[0], '0.5');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('param refused'));
  });

  it('routes edits through onParamChange instead of setParameterValues when provided', async () => {
    const onParamChange = vi.fn();
    const node = makeNode({ gain: { id: 'gain', minValue: 0, maxValue: 2 } });
    const panel = await createWamParameterPanel(node, { onParamChange });

    setSlider(slidersOf(panel)[0], '1.25');

    expect(onParamChange).toHaveBeenCalledWith('gain', 1.25);
    expect(node.setParameterValues).not.toHaveBeenCalled();
  });

  it('defaults absent minValue/maxValue to the WAM spec 0..1 range', async () => {
    const node = makeNode({ mix: { id: 'mix' } });
    const panel = await createWamParameterPanel(node);

    const slider = slidersOf(panel)[0];
    expect(slider.getAttribute('min')).toBe('0');
    expect(slider.getAttribute('max')).toBe('1');
  });

  it('uses the map key as the id when the info entry has none', async () => {
    const node = makeNode({ depth: { minValue: 0, maxValue: 1 } });
    const panel = await createWamParameterPanel(node);

    expect(slidersOf(panel)[0].getAttribute('data-param-id')).toBe('depth');
  });

  it('does not crash on slider edits when the node lacks setParameterValues', async () => {
    const node = { getParameterInfo: vi.fn().mockResolvedValue({ g: { minValue: 0, maxValue: 1 } }) };
    const panel = await createWamParameterPanel(node);

    expect(() => setSlider(slidersOf(panel)[0], '0.5')).not.toThrow();
  });

  it('throws a [waveform-playlist] error when getParameterInfo returns a non-object', async () => {
    const node = makeNode(null);
    await expect(createWamParameterPanel(node)).rejects.toThrow(/\[waveform-playlist\]/);
  });

  it('propagates a getParameterInfo rejection', async () => {
    const node = {
      getParameterInfo: vi.fn().mockRejectedValue(new Error('worklet gone')),
    };
    await expect(createWamParameterPanel(node)).rejects.toThrow('worklet gone');
  });

  it('throws when the node has no getParameterInfo function', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(createWamParameterPanel({} as any)).rejects.toThrow(/getParameterInfo/);
  });
});
