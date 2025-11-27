import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import type { UseTrackDynamicEffectsReturn } from '@waveform-playlist/browser';
import { effectCategories } from '@waveform-playlist/browser';

// Compact button for track controls
const EffectsButton = styled.button<{ $hasEffects: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 500;
  background: ${({ $hasEffects }) =>
    $hasEffects ? 'var(--ifm-color-primary, #3578e5)' : 'var(--ifm-background-surface-color, #f5f5f5)'};
  color: ${({ $hasEffects }) =>
    $hasEffects ? 'white' : 'var(--ifm-color-content-secondary, #666)'};
  border: 1px solid ${({ $hasEffects }) =>
    $hasEffects ? 'var(--ifm-color-primary, #3578e5)' : 'var(--ifm-color-emphasis-300, #ddd)'};
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
  justify-content: center;

  &:hover {
    background: ${({ $hasEffects }) =>
      $hasEffects ? 'var(--ifm-color-primary-dark, #2d66c3)' : 'var(--ifm-color-emphasis-200, #e0e0e0)'};
  }

  [data-theme='dark'] & {
    color: ${({ $hasEffects }) =>
      $hasEffects ? '#0a0a0f' : 'var(--ifm-color-content-secondary, #999)'};
  }
`;

const EffectsBadge = styled.span`
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.3);
  font-weight: 600;

  [data-theme='dark'] & {
    background: rgba(0, 0, 0, 0.3);
    color: #0a0a0f;
  }
`;

// Modal overlay
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  [data-theme='dark'] & {
    background: #1a1a1f;
  }
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--ifm-color-emphasis-200, #e0e0e0);
  background: #f5f5f5;

  [data-theme='dark'] & {
    background: #252530;
  }
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--ifm-color-content, #333);
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--ifm-color-content-secondary, #666);
  line-height: 1;
  padding: 0;

  &:hover {
    color: var(--ifm-color-content, #333);
  }
`;

const ModalBody = styled.div`
  padding: 16px;
  overflow-y: auto;
  flex: 1;
  background: #ffffff;

  [data-theme='dark'] & {
    background: #1a1a1f;
  }
`;

const AddEffectRow = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
`;

const EffectSelect = styled.select`
  flex: 1;
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid var(--ifm-color-emphasis-300, #ddd);
  border-radius: 4px;
  background: #ffffff;
  color: var(--ifm-color-content, #333);
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: var(--ifm-color-primary, #3578e5);
  }

  [data-theme='dark'] & {
    background: #252530;
    color: #e0e0e0;
    border-color: #404050;
  }
`;

const AddButton = styled.button`
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  background: var(--ifm-color-primary, #3578e5);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--ifm-color-primary-dark, #2d66c3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const EffectsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const EffectCard = styled.div`
  border: 1px solid var(--ifm-color-emphasis-200, #e0e0e0);
  border-radius: 6px;
  overflow: hidden;
`;

const EffectCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #f5f5f5;
  border-bottom: 1px solid var(--ifm-color-emphasis-200, #e0e0e0);

  [data-theme='dark'] & {
    background: #252530;
  }
`;

const EffectName = styled.span`
  font-weight: 500;
  font-size: 14px;
  color: var(--ifm-color-content, #333);
`;

const BypassButton = styled.button<{ $bypassed: boolean }>`
  padding: 4px 8px;
  font-size: 14px;
  background: ${({ $bypassed }) =>
    $bypassed ? 'var(--ifm-color-emphasis-300, #ddd)' : 'var(--ifm-color-success, #28a745)'};
  color: ${({ $bypassed }) =>
    $bypassed ? 'var(--ifm-color-content-secondary, #666)' : 'white'};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  line-height: 1;
  opacity: ${({ $bypassed }) => ($bypassed ? 0.6 : 1)};
  transition: all 0.15s ease;

  &:hover {
    background: ${({ $bypassed }) =>
      $bypassed ? 'var(--ifm-color-emphasis-400, #ccc)' : 'var(--ifm-color-success-dark, #218838)'};
    opacity: 1;
  }
`;

const RemoveButton = styled.button`
  padding: 4px 8px;
  font-size: 12px;
  background: var(--ifm-color-danger, #dc3545);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background: var(--ifm-color-danger-dark, #bd2130);
  }
`;

const HeaderButtons = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
`;

const ParametersGrid = styled.div`
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #ffffff;

  [data-theme='dark'] & {
    background: #1a1a1f;
  }
`;

const ParameterRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const ParamLabel = styled.label`
  width: 100px;
  font-size: 13px;
  color: var(--ifm-color-content-secondary, #666);
  flex-shrink: 0;
`;

const ParamSlider = styled.input`
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--ifm-color-emphasis-200, #e0e0e0);
  border-radius: 3px;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--ifm-color-primary, #3578e5);
    cursor: pointer;
  }
`;

const ParamValue = styled.span`
  width: 60px;
  text-align: right;
  font-family: monospace;
  font-size: 12px;
  color: var(--ifm-color-content, #333);
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 24px;
  color: var(--ifm-color-content-secondary, #666);
  font-size: 14px;
`;

interface TrackEffectControlsProps {
  trackId: string;
  trackName?: string;
  effectsManager: UseTrackDynamicEffectsReturn;
}

export const TrackEffectControls: React.FC<TrackEffectControlsProps> = ({
  trackId,
  trackName,
  effectsManager,
}) => {
  const {
    trackEffectsState,
    availableEffects,
    addEffectToTrack,
    removeEffectFromTrack,
    updateTrackEffectParameter,
    toggleBypass,
  } = effectsManager;

  const [isOpen, setIsOpen] = useState(false);
  const [selectedEffect, setSelectedEffect] = useState<string>('');

  const activeEffects = trackEffectsState.get(trackId) || [];

  const handleAdd = () => {
    if (selectedEffect) {
      addEffectToTrack(trackId, selectedEffect);
      setSelectedEffect('');
    }
  };

  const formatValue = (value: number, unit?: string) => {
    const formatted = value < 10 ? value.toFixed(2) : value < 100 ? value.toFixed(1) : Math.round(value);
    return unit ? `${formatted}${unit}` : String(formatted);
  };

  return (
    <>
      <EffectsButton
        $hasEffects={activeEffects.length > 0}
        onClick={() => setIsOpen(true)}
        title="Configure track effects"
      >
        FX
        {activeEffects.length > 0 && (
          <EffectsBadge>{activeEffects.length}</EffectsBadge>
        )}
      </EffectsButton>

      {isOpen && createPortal(
        <ModalOverlay onClick={() => setIsOpen(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>
                {trackName ? `${trackName} Effects` : 'Track Effects'}
              </ModalTitle>
              <CloseButton onClick={() => setIsOpen(false)}>&times;</CloseButton>
            </ModalHeader>

            <ModalBody>
              <AddEffectRow>
                <EffectSelect
                  value={selectedEffect}
                  onChange={(e) => setSelectedEffect(e.target.value)}
                >
                  <option value="">Select effect to add...</option>
                  {effectCategories.map((cat) => (
                    <optgroup key={cat.id} label={cat.name}>
                      {availableEffects
                        .filter((e) => e.category === cat.id)
                        .map((effect) => (
                          <option key={effect.id} value={effect.id}>
                            {effect.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </EffectSelect>
                <AddButton onClick={handleAdd} disabled={!selectedEffect}>
                  Add
                </AddButton>
              </AddEffectRow>

              {activeEffects.length === 0 ? (
                <EmptyState>
                  No effects added yet. Select an effect above to get started.
                </EmptyState>
              ) : (
                <EffectsList>
                  {activeEffects.map((effect) => (
                    <EffectCard key={effect.instanceId}>
                      <EffectCardHeader>
                        <EffectName style={{ opacity: effect.bypassed ? 0.5 : 1 }}>
                          {effect.definition.name}
                          {effect.bypassed && ' (bypassed)'}
                        </EffectName>
                        <HeaderButtons>
                          <BypassButton
                            $bypassed={effect.bypassed}
                            onClick={() => toggleBypass(trackId, effect.instanceId)}
                            title={effect.bypassed ? 'Enable effect' : 'Bypass effect'}
                          >
                            {'\u23FB'}
                          </BypassButton>
                          <RemoveButton
                            onClick={() => removeEffectFromTrack(trackId, effect.instanceId)}
                          >
                            Remove
                          </RemoveButton>
                        </HeaderButtons>
                      </EffectCardHeader>
                      <ParametersGrid>
                        {effect.definition.parameters
                          .filter((p) => p.type === 'number')
                          .map((param) => (
                            <ParameterRow key={param.name}>
                              <ParamLabel>{param.label}</ParamLabel>
                              <ParamSlider
                                type="range"
                                min={param.min ?? 0}
                                max={param.max ?? 1}
                                step={param.step ?? 0.01}
                                value={effect.params[param.name] as number}
                                onChange={(e) =>
                                  updateTrackEffectParameter(
                                    trackId,
                                    effect.instanceId,
                                    param.name,
                                    parseFloat(e.target.value)
                                  )
                                }
                              />
                              <ParamValue>
                                {formatValue(
                                  effect.params[param.name] as number,
                                  param.unit
                                )}
                              </ParamValue>
                            </ParameterRow>
                          ))}
                      </ParametersGrid>
                    </EffectCard>
                  ))}
                </EffectsList>
              )}
            </ModalBody>
          </ModalContent>
        </ModalOverlay>,
        document.body
      )}
    </>
  );
};
