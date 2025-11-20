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
    <CheckboxWrapper className={className}>
      <Checkbox
        type="checkbox"
        id="editable-annotations"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <Label htmlFor="editable-annotations">Editable Annotations</Label>
    </CheckboxWrapper>
  );
};
