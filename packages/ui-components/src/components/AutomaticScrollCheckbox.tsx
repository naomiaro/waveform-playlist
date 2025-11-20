import React from 'react';
import { CheckboxWrapper, StyledCheckbox, CheckboxLabel } from '../styled/CheckboxStyles';

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
      <StyledCheckbox
        type="checkbox"
        id="automatic-scroll"
        className="automatic-scroll"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
      />
      <CheckboxLabel htmlFor="automatic-scroll">Automatic Scroll</CheckboxLabel>
    </CheckboxWrapper>
  );
};
