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
    <CheckboxWrapper className={className}>
      <Checkbox
        type="checkbox"
        id="link-endpoints"
        className="link-endpoints"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
      />
      <Label htmlFor="link-endpoints">Link Endpoints</Label>
    </CheckboxWrapper>
  );
};
