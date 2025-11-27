import React from 'react';
import styled from 'styled-components';
import type { ActiveEffect, EffectParameter } from '@waveform-playlist/browser';

const PanelContainer = styled.div`
  background: var(--ifm-background-surface-color, #f5f5f5);
  border: 1px solid var(--ifm-color-emphasis-300, #ddd);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
`;

const PanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--ifm-color-emphasis-200, #eee);
`;

const EffectName = styled.h4`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ifm-color-content, #333);
`;

const CategoryBadge = styled.span`
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--ifm-color-primary-lighter, #e0e7ff);
  color: var(--ifm-color-primary-dark, #3b5998);
  text-transform: uppercase;
  font-weight: 500;

  [data-theme='dark'] & {
    background: var(--ifm-color-primary, #63C75F);
    color: #0a0a0f;
  }
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
  background: var(--ifm-color-danger, #dc3545);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--ifm-color-danger-dark, #c82333);
  }
`;

const HeaderButtons = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
`;

const ParametersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
`;

const ParameterControl = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ParameterLabel = styled.label`
  font-size: 11px;
  font-weight: 500;
  color: var(--ifm-color-content-secondary, #666);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ParameterValue = styled.span`
  font-size: 10px;
  color: var(--ifm-color-primary, #3578e5);
  font-weight: 600;
`;

const Slider = styled.input`
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--ifm-color-emphasis-200, #e0e0e0);
  outline: none;
  -webkit-appearance: none;
  appearance: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--ifm-color-primary, #3578e5);
    cursor: pointer;
    transition: transform 0.1s;
  }

  &::-webkit-slider-thumb:hover {
    transform: scale(1.1);
  }

  &::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--ifm-color-primary, #3578e5);
    cursor: pointer;
    border: none;
  }
`;

interface EffectPanelProps {
  effect: ActiveEffect;
  onParameterChange: (instanceId: string, paramName: string, value: number) => void;
  onToggleBypass: (instanceId: string) => void;
  onRemove: (instanceId: string) => void;
}

function formatValue(value: number, param: EffectParameter): string {
  const unit = param.unit || '';

  // Format based on step size
  if (param.step && param.step < 0.01) {
    return `${value.toFixed(3)}${unit}`;
  } else if (param.step && param.step < 0.1) {
    return `${value.toFixed(2)}${unit}`;
  } else if (param.step && param.step < 1) {
    return `${value.toFixed(1)}${unit}`;
  }
  return `${Math.round(value)}${unit}`;
}

export const EffectPanel: React.FC<EffectPanelProps> = ({
  effect,
  onParameterChange,
  onToggleBypass,
  onRemove,
}) => {
  return (
    <PanelContainer>
      <PanelHeader>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <EffectName style={{ opacity: effect.bypassed ? 0.5 : 1 }}>
            {effect.definition.name}
            {effect.bypassed && ' (bypassed)'}
          </EffectName>
          <CategoryBadge>{effect.definition.category}</CategoryBadge>
        </div>
        <HeaderButtons>
          <BypassButton
            $bypassed={effect.bypassed}
            onClick={() => onToggleBypass(effect.instanceId)}
            title={effect.bypassed ? 'Enable effect' : 'Bypass effect'}
          >
            {'\u23FB'}
          </BypassButton>
          <RemoveButton onClick={() => onRemove(effect.instanceId)}>
            Remove
          </RemoveButton>
        </HeaderButtons>
      </PanelHeader>
      <ParametersGrid>
        {effect.definition.parameters.map((param) => {
          const value = effect.params[param.name] as number;
          return (
            <ParameterControl key={param.name}>
              <ParameterLabel>
                {param.label}
                <ParameterValue>{formatValue(value, param)}</ParameterValue>
              </ParameterLabel>
              <Slider
                type="range"
                min={param.min}
                max={param.max}
                step={param.step}
                value={value}
                onChange={(e) =>
                  onParameterChange(effect.instanceId, param.name, parseFloat(e.target.value))
                }
              />
            </ParameterControl>
          );
        })}
      </ParametersGrid>
    </PanelContainer>
  );
};
