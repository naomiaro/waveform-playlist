import React, { useId } from 'react';
import {
  BaseCheckboxWrapper,
  BaseCheckbox,
  BaseCheckboxLabel,
} from '@waveform-playlist/ui-components';

export interface LinkEndpointsCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Checkbox control for enabling/disabling linked endpoints between annotations.
 * When enabled, the end time of one annotation is automatically linked to the start time of the next.
 */
export const LinkEndpointsCheckbox: React.FC<LinkEndpointsCheckboxProps> = ({
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
        className="link-endpoints"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
      />
      <BaseCheckboxLabel htmlFor={id}>Link Endpoints</BaseCheckboxLabel>
    </BaseCheckboxWrapper>
  );
};
