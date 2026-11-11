import React, { useRef, useEffect, useId, useState } from 'react';
import styled from 'styled-components';
import type {
  SpectrogramConfig,
  ColorMapValue,
  ColorMapName,
  FFTSize,
} from '@waveform-playlist/core';

export interface SpectrogramSettingsModalProps {
  open: boolean;
  onClose: () => void;
  config: SpectrogramConfig;
  colorMap: ColorMapValue;
  onApply: (config: SpectrogramConfig, colorMap: ColorMapValue) => void;
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
  background: ${(p) => (p.$primary ? 'var(--ifm-color-primary, #4a9)' : 'transparent')};
  color: ${(p) => (p.$primary ? '#fff' : 'inherit')};

  &:hover {
    opacity: 0.85;
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

type SettingsFormProps = Omit<SpectrogramSettingsModalProps, 'open'>;

/**
 * The form is a draft of the settings. It is mounted only while the dialog is
 * open, so its state starts from the props each time the dialog opens and is
 * never overwritten by a parent re-render while the user is editing.
 */
const SettingsForm: React.FC<SettingsFormProps> = ({ onClose, config, colorMap, onApply }) => {
  const id = useId();
  const [fftSize, setFftSize] = useState(config.fftSize ?? 2048);
  const [windowFn, setWindowFn] = useState(config.windowFunction ?? 'hann');
  const [freqScale, setFreqScale] = useState(config.frequencyScale ?? 'mel');
  const [localColorMap, setLocalColorMap] = useState<ColorMapName>(
    typeof colorMap === 'string' ? colorMap : 'viridis'
  );
  const [minFreq, setMinFreq] = useState(config.minFrequency ?? 0);
  const [maxFreq, setMaxFreq] = useState(config.maxFrequency ?? 20000);
  const [gainDb, setGainDb] = useState(config.gainDb ?? 20);
  const [rangeDb, setRangeDb] = useState(config.rangeDb ?? 80);
  const [zeroPadding, setZeroPadding] = useState(config.zeroPaddingFactor ?? 2);
  const [hopSize, setHopSize] = useState(
    config.hopSize ?? Math.floor((config.fftSize ?? 2048) / 4)
  );
  const [showLabels, setShowLabels] = useState(config.labels ?? false);

  const handleApply = () => {
    onApply(
      {
        fftSize,
        windowFunction: windowFn as SpectrogramConfig['windowFunction'],
        frequencyScale: freqScale as SpectrogramConfig['frequencyScale'],
        minFrequency: minFreq,
        maxFrequency: maxFreq,
        gainDb,
        rangeDb,
        zeroPaddingFactor: zeroPadding,
        hopSize,
        labels: showLabels,
      },
      localColorMap
    );
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
              setFftSize(v);
              setHopSize(Math.floor(v / 4));
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
            onChange={(e) => setHopSize(Number(e.target.value))}
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
            onChange={(e) => setZeroPadding(Number(e.target.value))}
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
            onChange={(e) => setWindowFn(e.target.value as typeof windowFn)}
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
            onChange={(e) => setFreqScale(e.target.value as typeof freqScale)}
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
            value={localColorMap}
            onChange={(e) => setLocalColorMap(e.target.value as ColorMapName)}
          >
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
            onChange={(e) => setMinFreq(Number(e.target.value))}
          />
        </Field>

        <Field>
          <Label htmlFor={`${id}-max-frequency`}>Max Frequency (Hz)</Label>
          <NumberInput
            id={`${id}-max-frequency`}
            type="number"
            min={1000}
            max={22050}
            step={50}
            value={maxFreq}
            onChange={(e) => setMaxFreq(Number(e.target.value))}
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
            onChange={(e) => setRangeDb(Number(e.target.value))}
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
            onChange={(e) => setGainDb(Number(e.target.value))}
          />
        </Field>

        <Field $span>
          <CheckboxLabel>
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
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
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Latest props for the native `close` listener, so the listener is attached
  // once and not re-added whenever the parent passes a new `onClose`.
  const latestRef = useRef({ open, onClose });
  useEffect(() => {
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

  useEffect(() => {
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
        <SettingsForm onClose={onClose} config={config} colorMap={colorMap} onApply={onApply} />
      )}
    </StyledDialog>
  );
};
