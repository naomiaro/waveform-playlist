import React from 'react';
import styled from 'styled-components';

const Label = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  user-select: none;
`;

const Checkbox = styled.input.attrs({ type: 'checkbox' })`
  cursor: pointer;
`;

export interface EditableCheckboxProps {
  checked: boolean;
  onChange: (enabled: boolean) => void;
  className?: string;
}

export const EditableCheckbox: React.FC<EditableCheckboxProps> = ({
  checked,
  onChange,
  className,
}) => {
  return (
    <Label className={className}>
      <Checkbox
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      Editable Annotations
    </Label>
  );
};
