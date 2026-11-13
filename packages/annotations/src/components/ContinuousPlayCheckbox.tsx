import React, { useId } from 'react';
import {
  BaseCheckboxWrapper,
  BaseCheckbox,
  BaseCheckboxLabel,
} from '@waveform-playlist/ui-components';

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
  // Generated: two of this checkbox on one page must not share an id.
  const id = useId();
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  return (
    <BaseCheckboxWrapper className={className}>
      <BaseCheckbox
        type="checkbox"
        id={id}
        className="continuous-play"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
      />
      <BaseCheckboxLabel htmlFor={id}>Continuous Play</BaseCheckboxLabel>
    </BaseCheckboxWrapper>
  );
};
