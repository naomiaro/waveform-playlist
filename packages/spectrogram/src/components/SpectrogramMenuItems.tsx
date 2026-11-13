import React from 'react';
import styled from 'styled-components';
import type { RenderMode } from '@waveform-playlist/core';
import type { SpectrogramIntegration } from '@waveform-playlist/browser';

/** The items browser's track menu asks the spectrogram integration for:
 *  ui-components' `TrackMenuItem[]`, named through the type that carries it. */
type MenuItems = ReturnType<NonNullable<SpectrogramIntegration['renderMenuItems']>>;

const SectionLabel = styled.div`
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.5;
  margin-bottom: 0.25rem;
`;

const RadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0;
  font-size: 0.8rem;
  cursor: pointer;

  &:hover {
    opacity: 0.8;
  }
`;

const SettingsButton = styled.button`
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0.35rem 0.75rem;
  width: 100%;
  text-align: left;

  &:hover {
    background: rgba(128, 128, 128, 0.15);
  }
`;

const DropdownSection = styled.div`
  padding: 0.25rem 0.75rem;
`;

const RENDER_MODES: { value: RenderMode; label: string }[] = [
  { value: 'waveform', label: 'Waveform' },
  { value: 'spectrogram', label: 'Spectrogram' },
  { value: 'both', label: 'Both' },
];

export interface SpectrogramMenuItemsProps {
  renderMode: RenderMode;
  onRenderModeChange: (mode: RenderMode) => void;
  onOpenSettings: () => void;
  onClose?: () => void;
}

/**
 * Returns the track menu items (`TrackMenuItem[]` of ui-components) for the
 * spectrogram display mode radios and settings button.
 */
export function SpectrogramMenuItems({
  renderMode,
  onRenderModeChange,
  onOpenSettings,
  onClose,
}: SpectrogramMenuItemsProps): MenuItems {
  return [
    {
      id: 'spectrogram-display',
      label: 'Display',
      content: (
        <DropdownSection>
          <SectionLabel>Display</SectionLabel>
          {RENDER_MODES.map(({ value, label }) => (
            <RadioLabel key={value}>
              <input
                type="radio"
                name="render-mode"
                checked={renderMode === value}
                onChange={() => {
                  onRenderModeChange(value);
                  onClose?.();
                }}
              />
              {label}
            </RadioLabel>
          ))}
        </DropdownSection>
      ),
    },
    {
      id: 'spectrogram-settings',
      content: (
        <SettingsButton
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
            onOpenSettings();
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          Spectrogram Settings...
        </SettingsButton>
      ),
    },
  ];
}
