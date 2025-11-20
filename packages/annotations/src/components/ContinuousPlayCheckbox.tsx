import React from 'react';
import { CheckboxWrapper, StyledCheckbox, CheckboxLabel } from '@waveform-playlist/ui-components';

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
      <StyledCheckbox
        type="checkbox"
        id="continuous-play"
        className="continuous-play"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
      />
      <CheckboxLabel htmlFor="continuous-play">Continuous Play</CheckboxLabel>
    </CheckboxWrapper>
  );
};
