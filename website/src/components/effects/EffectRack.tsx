import React from 'react';
import styled from 'styled-components';
import type { UseDynamicEffectsReturn } from '@waveform-playlist/browser';
import { EffectSelector } from './EffectSelector';
import { EffectPanel } from './EffectPanel';

const RackContainer = styled.div`
  background: var(--ifm-background-surface-color, #f8f9fa);
  border: 1px solid var(--ifm-color-emphasis-300, #ddd);
  border-radius: 8px;
  padding: 16px;
`;

const RackHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
`;

const RackTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--ifm-color-content, #333);
  display: flex;
  align-items: center;
  gap: 8px;
`;

const EffectCount = styled.span`
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--ifm-color-primary, #3578e5);
  color: white;
  font-weight: 500;

  [data-theme='dark'] & {
    color: #0a0a0f;
  }
`;

const EffectsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 24px;
  color: var(--ifm-color-content-secondary, #666);
  font-size: 14px;
  background: var(--ifm-background-color, white);
  border-radius: 8px;
  border: 2px dashed var(--ifm-color-emphasis-300, #ddd);
`;

const ChainInfo = styled.div`
  margin-top: 12px;
  padding: 8px 12px;
  background: var(--ifm-color-emphasis-100, #f0f0f0);
  border-radius: 6px;
  font-size: 12px;
  color: var(--ifm-color-content-secondary, #666);
`;

const ChainArrow = styled.span`
  margin: 0 6px;
  color: var(--ifm-color-primary, #3578e5);
`;

interface EffectRackProps {
  effectsManager: UseDynamicEffectsReturn;
  title?: string;
}

export const EffectRack: React.FC<EffectRackProps> = ({
  effectsManager,
  title = 'Master Effects Chain',
}) => {
  const {
    activeEffects,
    availableEffects,
    addEffect,
    removeEffect,
    updateParameter,
    toggleBypass,
    clearAllEffects,
  } = effectsManager;

  return (
    <RackContainer>
      <RackHeader>
        <RackTitle>
          {title}
          {activeEffects.length > 0 && (
            <EffectCount>{activeEffects.length}</EffectCount>
          )}
        </RackTitle>
        <EffectSelector
          availableEffects={availableEffects}
          onAddEffect={addEffect}
          onClearAll={clearAllEffects}
          hasActiveEffects={activeEffects.length > 0}
        />
      </RackHeader>

      {activeEffects.length === 0 ? (
        <EmptyState>
          No effects added yet. Select an effect from the dropdown above to get started.
        </EmptyState>
      ) : (
        <>
          <EffectsList>
            {activeEffects.map((effect) => (
              <EffectPanel
                key={effect.instanceId}
                effect={effect}
                onParameterChange={updateParameter}
                onToggleBypass={toggleBypass}
                onRemove={removeEffect}
              />
            ))}
          </EffectsList>

          <ChainInfo>
            Signal chain: Input
            {activeEffects.map((effect, index) => (
              <React.Fragment key={effect.instanceId}>
                <ChainArrow>→</ChainArrow>
                {effect.definition.name}
              </React.Fragment>
            ))}
            <ChainArrow>→</ChainArrow>
            Output
          </ChainInfo>
        </>
      )}
    </RackContainer>
  );
};
