import React from 'react';
import { BaseCheckboxWrapper, BaseCheckbox, BaseCheckboxLabel } from '@waveform-playlist/ui-components';

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
    <BaseCheckboxWrapper className={className}>
      <BaseCheckbox
        type="checkbox"
        id="editable-annotations"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <BaseCheckboxLabel htmlFor="editable-annotations">Editable Annotations</BaseCheckboxLabel>
    </BaseCheckboxWrapper>
  );
};
