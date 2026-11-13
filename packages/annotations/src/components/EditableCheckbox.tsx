import React, { useId } from 'react';
import {
  BaseCheckboxWrapper,
  BaseCheckbox,
  BaseCheckboxLabel,
} from '@waveform-playlist/ui-components';

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
  // Generated: two of this checkbox on one page must not share an id.
  const id = useId();
  return (
    <BaseCheckboxWrapper className={className}>
      <BaseCheckbox
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <BaseCheckboxLabel htmlFor={id}>Editable Annotations</BaseCheckboxLabel>
    </BaseCheckboxWrapper>
  );
};
