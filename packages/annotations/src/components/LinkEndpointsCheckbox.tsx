import React from 'react';
import { BaseCheckboxWrapper, BaseCheckbox, BaseCheckboxLabel } from '@waveform-playlist/ui-components';

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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  return (
    <BaseCheckboxWrapper className={className}>
      <BaseCheckbox
        type="checkbox"
        id="link-endpoints"
        className="link-endpoints"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
      />
      <BaseCheckboxLabel htmlFor="link-endpoints">Link Endpoints</BaseCheckboxLabel>
    </BaseCheckboxWrapper>
  );
};
