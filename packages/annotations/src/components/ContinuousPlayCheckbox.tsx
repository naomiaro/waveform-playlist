import React from 'react';
import styled from 'styled-components';

const CheckboxWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`;

const Checkbox = styled.input`
  cursor: pointer;
`;

const Label = styled.label`
  margin: 0;
  cursor: pointer;
  user-select: none;
`;

export interface ContinuousPlayCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Checkbox control for enabling/disabling continuous play of annotations.
 * When enabled, playback continues from one annotation to the next without stopping.
 */
export const ContinuousPlayCheckbox: React.FC<ContinuousPlayCheckboxProps> = ({
  checked,
  onChange,
  disabled = false,
  className,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  return (
    <CheckboxWrapper className={className}>
      <Checkbox
        type="checkbox"
        id="continuous-play"
        className="continuous-play"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
      />
      <Label htmlFor="continuous-play">Continuous Play</Label>
    </CheckboxWrapper>
  );
};
