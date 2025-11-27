import React, { useState } from 'react';
import styled from 'styled-components';
import type { EffectDefinition } from '@waveform-playlist/browser';
import { effectCategories } from '@waveform-playlist/browser';

const SelectorContainer = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
`;

const SelectWrapper = styled.div`
  position: relative;
  display: flex;
  gap: 4px;
`;

const Select = styled.select`
  padding: 8px 12px;
  border: 1px solid var(--ifm-color-emphasis-300, #ddd);
  border-radius: 6px;
  background: var(--ifm-background-color, white);
  color: var(--ifm-color-content, #333);
  font-size: 13px;
  cursor: pointer;
  min-width: 140px;

  &:focus {
    outline: none;
    border-color: var(--ifm-color-primary, #3578e5);
    box-shadow: 0 0 0 2px var(--ifm-color-primary-lighter, rgba(53, 120, 229, 0.2));
  }

  option {
    background: var(--ifm-background-color, white);
    color: var(--ifm-color-content, #333);
  }
`;

const AddButton = styled.button`
  padding: 8px 16px;
  background: var(--ifm-color-primary, #3578e5);
  color: var(--ifm-color-primary-contrast-foreground, white);
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: var(--ifm-color-primary-dark, #2d66c3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  [data-theme='dark'] & {
    color: #0a0a0f;
  }
`;

const ClearButton = styled.button`
  padding: 8px 12px;
  background: transparent;
  color: var(--ifm-color-danger, #dc3545);
  border: 1px solid var(--ifm-color-danger, #dc3545);
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--ifm-color-danger, #dc3545);
    color: white;
  }
`;

interface EffectSelectorProps {
  availableEffects: EffectDefinition[];
  onAddEffect: (effectId: string) => void;
  onClearAll: () => void;
  hasActiveEffects: boolean;
}

export const EffectSelector: React.FC<EffectSelectorProps> = ({
  availableEffects,
  onAddEffect,
  onClearAll,
  hasActiveEffects,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedEffect, setSelectedEffect] = useState<string>('');

  // Filter effects by category
  const filteredEffects =
    selectedCategory === 'all'
      ? availableEffects
      : availableEffects.filter((e) => e.category === selectedCategory);

  const handleAdd = () => {
    if (selectedEffect) {
      onAddEffect(selectedEffect);
      setSelectedEffect('');
    }
  };

  return (
    <SelectorContainer>
      <SelectWrapper>
        <Select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            setSelectedEffect('');
          }}
        >
          <option value="all">All Categories</option>
          {effectCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </Select>
      </SelectWrapper>

      <SelectWrapper>
        <Select
          value={selectedEffect}
          onChange={(e) => setSelectedEffect(e.target.value)}
        >
          <option value="">Select Effect...</option>
          {filteredEffects.map((effect) => (
            <option key={effect.id} value={effect.id}>
              {effect.name}
            </option>
          ))}
        </Select>
      </SelectWrapper>

      <AddButton onClick={handleAdd} disabled={!selectedEffect}>
        Add Effect
      </AddButton>

      {hasActiveEffects && (
        <ClearButton onClick={onClearAll}>Clear All</ClearButton>
      )}
    </SelectorContainer>
  );
};
