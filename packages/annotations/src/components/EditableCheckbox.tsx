import React from 'react';
import { CheckboxWrapper, StyledCheckbox, CheckboxLabel } from '@waveform-playlist/ui-components';

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
      <StyledCheckbox
        type="checkbox"
        id="editable-annotations"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <CheckboxLabel htmlFor="editable-annotations">Editable Annotations</CheckboxLabel>
    </CheckboxWrapper>
  );
};
