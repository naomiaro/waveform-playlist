import React, { useRef, useEffect, useId, useLayoutEffect, useState } from 'react';
import styled from 'styled-components';
import {
  SPECTROGRAM_DEFAULTS,
  type SpectrogramConfig,
  type ColorMapValue,
  type ColorMapName,
  type FFTSize,
} from '@waveform-playlist/core';

export interface SpectrogramSettingsModalProps {
  open: boolean;
  onClose: () => void;
  config: SpectrogramConfig;
  colorMap: ColorMapValue;
  /**
   * Called on Apply with the config it was given plus the fields the user
   * changed, and the colour map (the one given unless the user picked one).
   * Not called when nothing was changed: Apply then only closes.
   */
  onApply: (config: SpectrogramConfig, colorMap: ColorMapValue) => void;
  /**
   * The sample rate of the audio. With a config that has no `maxFrequency`,
   * the field shows half of it, the top the spectrogram is drawn to.
   */
  sampleRate?: number;
}

const StyledDialog = styled.dialog`
  border: 1px solid rgba(128, 128, 128, 0.4);
  border-radius: 8px;
  padding: 1.5rem;
  background: ${(p) => p.theme.timescaleBackgroundColor ?? '#222'};
  color: ${(p) => p.theme.textColor ?? 'inherit'};
  min-width: 380px;
  max-width: 500px;
  overscroll-behavior: contain;

  &::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }
`;

const Title = styled.h3`
  margin: 0 0 1rem;
  font-size: 1rem;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
`;

const Field = styled.div<{ $span?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  grid-column: ${(p) => (p.$span ? '1 / -1' : 'auto')};
`;

const Label = styled.label`
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.6;
`;

const Select = styled.select`
  padding: 0.3rem 0.4rem;
  border: 1px solid rgba(128, 128, 128, 0.4);
  border-radius: 4px;
  background: rgba(128, 128, 128, 0.15);
  color: inherit;
  font-size: 0.85rem;
`;

const NumberInput = styled.input`
  padding: 0.3rem 0.4rem;
  border: 1px solid rgba(128, 128, 128, 0.4);
  border-radius: 4px;
  background: rgba(128, 128, 128, 0.15);
  color: inherit;
  font-size: 0.85rem;
  width: 100%;
  box-sizing: border-box;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  cursor: pointer;
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.25rem;
`;

const ModalButton = styled.button<{ $primary?: boolean }>`
  padding: 0.4rem 1rem;
  border: 1px solid rgba(128, 128, 128, 0.4);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  background: ${(p) => (p.$primary ? (p.theme.buttonBackground ?? '#0091ff') : 'transparent')};
  color: ${(p) => (p.$primary ? (p.theme.buttonText ?? '#fff') : 'inherit')};
  ${(p) => (p.$primary && p.theme.buttonBorder ? `border-color: ${p.theme.buttonBorder};` : '')}

  &:hover {
    ${(p) =>
      p.$primary && p.theme.buttonHoverBackground
        ? `background: ${p.theme.buttonHoverBackground};`
        : 'opacity: 0.85;'}
  }
`;

const FFT_SIZES = [256, 512, 1024, 2048, 4096, 8192];
const WINDOW_FUNCTIONS = [
  'hann',
  'hamming',
  'blackman',
  'blackman-harris',
  'bartlett',
  'rectangular',
] as const;
const FREQ_SCALES = ['linear', 'logarithmic', 'mel', 'bark', 'erb'] as const;
const COLOR_MAPS: ColorMapName[] = ['viridis', 'magma', 'inferno', 'grayscale', 'igray', 'roseus'];
/** The select's value for a colour map given as an array of colours. */
const CUSTOM_COLOR_MAP = 'custom';

type SettingsFormProps = Omit<SpectrogramSettingsModalProps, 'open'>;

/**
 * The form is a draft of the settings. It is mounted only while the dialog is
 * open, so its state starts from the props each time the dialog opens and is
 * never overwritten by a parent re-render while the user is editing.
 *
 * The draft holds only the fields the user changed (#814). A field shows its
 * edit, else the config's value, else the default; Apply sends the config it
 * was given with the edits on top, so a field the form does not show
 * (`alpha`, `labelsColor`, `labelsBackground`) and a field left at its default
 * (`maxFrequency`: half the sample rate) are not written.
 */
const SettingsForm: React.FC<SettingsFormProps> = ({
  onClose,
  config,
  colorMap,
  onApply,
  sampleRate,
}) => {
  const id = useId();
  const [edits, setEdits] = useState<SpectrogramConfig>({});
  const [editedColorMap, setEditedColorMap] = useState<ColorMapName | undefined>(undefined);

  const shown = <K extends keyof SpectrogramConfig>(key: K): SpectrogramConfig[K] =>
    key in edits ? edits[key] : config[key];
  const edit = (changes: SpectrogramConfig) => setEdits((prev) => ({ ...prev, ...changes }));

  const fftSize = shown('fftSize') ?? SPECTROGRAM_DEFAULTS.fftSize;
  const hopSize = shown('hopSize') ?? Math.floor(fftSize / 4);
  const zeroPadding = shown('zeroPaddingFactor') ?? SPECTROGRAM_DEFAULTS.zeroPaddingFactor;
  const windowFn = shown('windowFunction') ?? SPECTROGRAM_DEFAULTS.windowFunction;
  const freqScale = shown('frequencyScale') ?? SPECTROGRAM_DEFAULTS.frequencyScale;
  const minFreq = shown('minFrequency') ?? SPECTROGRAM_DEFAULTS.minFrequency;
  const nyquist = sampleRate !== undefined ? sampleRate / 2 : undefined;
  // An emptied field stays empty while the user types (Apply then leaves the
  // default); only an untouched one shows the default's number.
  const maxFreq = 'maxFrequency' in edits ? edits.maxFrequency : (config.maxFrequency ?? nyquist);
  const gainDb = shown('gainDb') ?? SPECTROGRAM_DEFAULTS.gainDb;
  const rangeDb = shown('rangeDb') ?? SPECTROGRAM_DEFAULTS.rangeDb;
  const showLabels = shown('labels') ?? SPECTROGRAM_DEFAULTS.labels;
  const isCustomColorMap = typeof colorMap !== 'string';
  const colorMapValue = editedColorMap ?? (isCustomColorMap ? CUSTOM_COLOR_MAP : colorMap);

  const handleApply = () => {
    // A field set back to the value it had is no change. With none, Apply
    // only closes: an onApply would be an undo step that changes nothing.
    const configChanged = (Object.keys(edits) as Array<keyof SpectrogramConfig>).some(
      (key) => edits[key] !== config[key]
    );
    const colorMapChanged = editedColorMap !== undefined && editedColorMap !== colorMap;
    if (configChanged || colorMapChanged) {
      onApply({ ...config, ...edits }, editedColorMap ?? colorMap);
    }
    onClose();
  };

  return (
    <>
      <FormGrid>
        <Field>
          <Label htmlFor={`${id}-fft-size`}>FFT Size</Label>
          <Select
            id={`${id}-fft-size`}
            value={fftSize}
            onChange={(e) => {
              const v = Number(e.target.value) as FFTSize;
              edit({ fftSize: v, hopSize: Math.floor(v / 4) });
            }}
          >
            {FFT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

        <Field>
          <Label htmlFor={`${id}-hop-size`}>Hop Size</Label>
          <Select
            id={`${id}-hop-size`}
            value={hopSize}
            onChange={(e) => edit({ hopSize: Number(e.target.value) })}
          >
            {[
              { label: `${fftSize} (no overlap)`, value: fftSize },
              { label: `${Math.floor(fftSize / 2)} (50%)`, value: Math.floor(fftSize / 2) },
              { label: `${Math.floor(fftSize / 4)} (75%)`, value: Math.floor(fftSize / 4) },
              { label: `${Math.floor(fftSize / 8)} (87.5%)`, value: Math.floor(fftSize / 8) },
            ].map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field>
          <Label htmlFor={`${id}-zero-padding`}>Zero Padding</Label>
          <Select
            id={`${id}-zero-padding`}
            value={zeroPadding}
            onChange={(e) => edit({ zeroPaddingFactor: Number(e.target.value) })}
          >
            {[1, 2, 4, 8, 16].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        </Field>

        <Field>
          <Label htmlFor={`${id}-window-function`}>Window Function</Label>
          <Select
            id={`${id}-window-function`}
            value={windowFn}
            onChange={(e) =>
              edit({ windowFunction: e.target.value as SpectrogramConfig['windowFunction'] })
            }
          >
            {WINDOW_FUNCTIONS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </Select>
        </Field>

        <Field>
          <Label htmlFor={`${id}-frequency-scale`}>Frequency Scale</Label>
          <Select
            id={`${id}-frequency-scale`}
            value={freqScale}
            onChange={(e) =>
              edit({ frequencyScale: e.target.value as SpectrogramConfig['frequencyScale'] })
            }
          >
            {FREQ_SCALES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

        <Field>
          <Label htmlFor={`${id}-color-map`}>Color Map</Label>
          <Select
            id={`${id}-color-map`}
            value={colorMapValue}
            onChange={(e) => setEditedColorMap(e.target.value as ColorMapName)}
          >
            {isCustomColorMap && <option value={CUSTOM_COLOR_MAP}>{CUSTOM_COLOR_MAP}</option>}
            {COLOR_MAPS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>

        <Field>
          <Label htmlFor={`${id}-min-frequency`}>Min Frequency (Hz)</Label>
          <NumberInput
            id={`${id}-min-frequency`}
            type="number"
            min={0}
            max={5000}
            step={50}
            value={minFreq}
            onChange={(e) => edit({ minFrequency: Number(e.target.value) })}
          />
        </Field>

        <Field>
          <Label htmlFor={`${id}-max-frequency`}>Max Frequency (Hz)</Label>
          <NumberInput
            id={`${id}-max-frequency`}
            type="number"
            min={1000}
            max={nyquist}
            step={50}
            value={maxFreq ?? ''}
            onChange={(e) =>
              // Emptied: back to the default, half the sample rate.
              edit({ maxFrequency: e.target.value === '' ? undefined : Number(e.target.value) })
            }
          />
        </Field>

        <Field>
          <Label htmlFor={`${id}-range-db`}>Range (dB)</Label>
          <NumberInput
            id={`${id}-range-db`}
            type="number"
            min={1}
            max={120}
            step={1}
            value={rangeDb}
            onChange={(e) => edit({ rangeDb: Number(e.target.value) })}
          />
        </Field>

        <Field>
          <Label htmlFor={`${id}-gain-db`}>Gain (dB)</Label>
          <NumberInput
            id={`${id}-gain-db`}
            type="number"
            min={-20}
            max={60}
            step={1}
            value={gainDb}
            onChange={(e) => edit({ gainDb: Number(e.target.value) })}
          />
        </Field>

        <Field $span>
          <CheckboxLabel>
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => edit({ labels: e.target.checked })}
            />
            Show Frequency Labels
          </CheckboxLabel>
        </Field>
      </FormGrid>

      <ButtonRow>
        <ModalButton type="button" onClick={onClose}>
          Cancel
        </ModalButton>
        <ModalButton type="button" $primary onClick={handleApply}>
          Apply
        </ModalButton>
      </ButtonRow>
    </>
  );
};

export const SpectrogramSettingsModal: React.FC<SpectrogramSettingsModalProps> = ({
  open,
  onClose,
  config,
  colorMap,
  onApply,
  sampleRate,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Latest props for the native `close` listener, so the listener is attached
  // once and not re-added whenever the parent passes a new `onClose`.
  const latestRef = useRef({ open, onClose });
  useLayoutEffect(() => {
    latestRef.current = { open, onClose };
  });

  // Native close (Escape key)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      // Only report a close the parent did not ask for (avoids double-fire)
      if (latestRef.current.open) {
        latestRef.current.onClose();
      }
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, []);

  // Layout effect: the dialog opens and closes in the same frame as the form
  // mounts and unmounts, whatever triggered the change.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <StyledDialog ref={dialogRef} aria-labelledby={titleId}>
      <Title id={titleId}>Spectrogram Settings</Title>
      {open && (
        <SettingsForm
          onClose={onClose}
          config={config}
          colorMap={colorMap}
          onApply={onApply}
          sampleRate={sampleRate}
        />
      )}
    </StyledDialog>
  );
};
