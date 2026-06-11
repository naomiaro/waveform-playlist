const PREFIX = '[waveform-playlist] ';

/** One slider's metadata for the generic parameter panel. */
export interface ParameterPanelParam {
  id: string;
  /** Display name; falls back to `id`. */
  label?: string;
  min: number;
  max: number;
  /** Slider step; omitted means continuous (`step="any"`). */
  step?: number;
  /** Initial slider position; clamped into [min, max]; defaults to `min`. */
  value?: number;
  /** Display unit suffix ('Hz', 'dB', 's', …). */
  unit?: string;
}

export type ParameterPanelChangeHandler = (paramId: string, value: number) => void;

/** Structural view of a WAM parameter-info entry (subset the panel uses). */
export interface WamParameterInfoLike {
  id?: string;
  label?: string;
  minValue?: number;
  maxValue?: number;
  defaultValue?: number;
  discreteStep?: number;
  units?: string;
}

/** The slice of a WamNode the WAM parameter panel needs. */
export interface WamParameterPanelNode {
  getParameterInfo(...parameterIds: string[]): Promise<unknown>;
  setParameterValues?(
    values: Record<string, { id: string; value: number; normalized: boolean }>
  ): Promise<void>;
}

export interface CreateWamParameterPanelOptions {
  /** Override where slider edits go. Default: `node.setParameterValues`. */
  onParamChange?: ParameterPanelChangeHandler;
}

/**
 * Build a plain-DOM panel of labeled range sliders from generic parameter
 * metadata. Framework-agnostic (no Lit/React); themable via the dawcore
 * `--daw-*` CSS custom properties (`--daw-controls-text`,
 * `--daw-controls-background`, `--daw-wave-color`). Malformed entries are
 * skipped with a warning; an empty list renders an empty-state message.
 */
export function createParameterPanel(
  params: ParameterPanelParam[],
  onChange: ParameterPanelChangeHandler
): HTMLElement {
  if (!Array.isArray(params)) {
    throw new Error(PREFIX + 'createParameterPanel: params must be an array');
  }
  if (typeof onChange !== 'function') {
    throw new Error(PREFIX + 'createParameterPanel: onChange must be a function');
  }

  const panel = document.createElement('div');
  panel.className = 'daw-param-panel';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.gap = '8px';
  panel.style.padding = '12px';
  panel.style.boxSizing = 'border-box';
  panel.style.font = '12px/1.4 system-ui, sans-serif';
  panel.style.color = 'var(--daw-controls-text, #e6e6e6)';
  panel.style.background = 'var(--daw-controls-background, transparent)';
  panel.style.borderRadius = '4px';

  const usable = params.filter(isUsableParam);
  if (usable.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'daw-param-panel-empty';
    empty.textContent = 'No adjustable parameters.';
    empty.style.margin = '0';
    empty.style.opacity = '0.7';
    panel.appendChild(empty);
    return panel;
  }

  for (const param of usable) {
    panel.appendChild(createParamRow(param, onChange));
  }
  return panel;
}

/**
 * Build the generic parameter panel for a WAM plugin from
 * `await node.getParameterInfo()`. Used as the GUI fallback when a plugin has
 * no `createGui` (or its `createGui` throws). Slider edits call
 * `node.setParameterValues` unless `onParamChange` overrides the routing.
 */
export async function createWamParameterPanel(
  node: WamParameterPanelNode,
  options: CreateWamParameterPanelOptions = {}
): Promise<HTMLElement> {
  if (!node || typeof node.getParameterInfo !== 'function') {
    throw new Error(
      PREFIX + 'createWamParameterPanel: node must expose getParameterInfo() (a WamNode-like)'
    );
  }
  const info = await node.getParameterInfo();
  if (info === null || typeof info !== 'object') {
    throw new Error(
      PREFIX +
        'createWamParameterPanel: getParameterInfo() returned ' +
        String(info) +
        ' — expected a parameter-info map'
    );
  }

  const params: ParameterPanelParam[] = [];
  for (const [key, raw] of Object.entries(info as Record<string, unknown>)) {
    const mapped = toPanelParam(key, raw);
    if (mapped) params.push(mapped);
  }

  const onChange = options.onParamChange ?? makeSetParameterValuesHandler(node);
  return createParameterPanel(params, onChange);
}

function makeSetParameterValuesHandler(node: WamParameterPanelNode): ParameterPanelChangeHandler {
  return (paramId, value) => {
    node
      .setParameterValues?.({ [paramId]: { id: paramId, value, normalized: false } })
      ?.catch((err: unknown) => {
        console.warn(
          PREFIX +
            'parameter panel: setParameterValues failed for "' +
            paramId +
            '": ' +
            String(err)
        );
      });
  };
}

/** Map one WamParameterInfo entry onto a panel param; null (with a warning) when malformed. */
function toPanelParam(key: string, raw: unknown): ParameterPanelParam | null {
  if (raw === null || typeof raw !== 'object') {
    console.warn(
      PREFIX + 'createWamParameterPanel: skipping malformed parameter info for "' + key + '"'
    );
    return null;
  }
  const r = raw as WamParameterInfoLike;
  const id = typeof r.id === 'string' && r.id.length > 0 ? r.id : key;
  // The WAM spec defaults an unspecified range to [0, 1].
  const min = isFiniteNumber(r.minValue) ? r.minValue : 0;
  const max = isFiniteNumber(r.maxValue) ? r.maxValue : 1;
  return {
    id,
    min,
    max,
    ...(typeof r.label === 'string' && r.label.length > 0 ? { label: r.label } : {}),
    ...(isFiniteNumber(r.discreteStep) && r.discreteStep > 0 ? { step: r.discreteStep } : {}),
    ...(isFiniteNumber(r.defaultValue) ? { value: r.defaultValue } : {}),
    ...(typeof r.units === 'string' && r.units.length > 0 ? { unit: r.units } : {}),
  };
}

function isUsableParam(param: ParameterPanelParam): boolean {
  if (typeof param.id !== 'string' || param.id.length === 0) {
    console.warn(PREFIX + 'createParameterPanel: skipping a parameter with no id');
    return false;
  }
  if (!isFiniteNumber(param.min) || !isFiniteNumber(param.max) || param.max <= param.min) {
    console.warn(
      PREFIX +
        'createParameterPanel: skipping parameter "' +
        param.id +
        '" — invalid range [' +
        String(param.min) +
        ', ' +
        String(param.max) +
        ']'
    );
    return false;
  }
  return true;
}

function createParamRow(
  param: ParameterPanelParam,
  onChange: ParameterPanelChangeHandler
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'daw-param-row';
  row.style.display = 'flex';
  row.style.flexDirection = 'column';
  row.style.gap = '4px';

  const labelRow = document.createElement('div');
  labelRow.className = 'daw-param-label';
  labelRow.style.display = 'flex';
  labelRow.style.justifyContent = 'space-between';
  labelRow.style.gap = '8px';

  const name = document.createElement('span');
  name.className = 'daw-param-name';
  name.textContent = param.label ?? param.id;

  const readout = document.createElement('span');
  readout.className = 'daw-param-value';
  readout.style.opacity = '0.8';
  readout.style.fontVariantNumeric = 'tabular-nums';

  const slider = document.createElement('input');
  slider.className = 'daw-param-slider';
  slider.type = 'range';
  slider.setAttribute('data-param-id', param.id);
  slider.min = String(param.min);
  slider.max = String(param.max);
  slider.step = isFiniteNumber(param.step) && param.step > 0 ? String(param.step) : 'any';
  const initial = clamp(
    isFiniteNumber(param.value) ? param.value : param.min,
    param.min,
    param.max
  );
  slider.value = String(initial);
  slider.style.width = '100%';
  slider.style.margin = '0';
  slider.style.accentColor = 'var(--daw-wave-color, #c49a6c)';

  readout.textContent = formatValue(initial, param.unit);

  slider.addEventListener('input', () => {
    const value = Number(slider.value);
    if (!Number.isFinite(value)) return;
    readout.textContent = formatValue(value, param.unit);
    onChange(param.id, value);
  });

  labelRow.appendChild(name);
  labelRow.appendChild(readout);
  row.appendChild(labelRow);
  row.appendChild(slider);
  return row;
}

function formatValue(value: number, unit?: string): string {
  // toFixed(4) → parseFloat strips float noise without padding zeros.
  const rounded = String(parseFloat(value.toFixed(4)));
  return unit !== undefined && unit.length > 0 ? rounded + ' ' + unit : rounded;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
