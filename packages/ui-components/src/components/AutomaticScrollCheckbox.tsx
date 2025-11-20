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

export interface AutomaticScrollCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Checkbox control for enabling/disabling automatic scroll during playback
 */
export const AutomaticScrollCheckbox: React.FC<AutomaticScrollCheckboxProps> = ({
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
        id="automatic-scroll"
        className="automatic-scroll"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
      />
      <Label htmlFor="automatic-scroll">Automatic Scroll</Label>
    </CheckboxWrapper>
  );
};
