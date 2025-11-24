import React from 'react';
import { BaseCheckboxWrapper, BaseCheckbox, BaseCheckboxLabel } from '../styled/index';

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
    <BaseCheckboxWrapper className={className}>
      <BaseCheckbox
        type="checkbox"
        id="automatic-scroll"
        className="automatic-scroll"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
      />
      <BaseCheckboxLabel htmlFor="automatic-scroll">Automatic Scroll</BaseCheckboxLabel>
    </BaseCheckboxWrapper>
  );
};
