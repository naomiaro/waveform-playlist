import React, { useId } from 'react';
import {
  BaseCheckboxWrapper,
  BaseCheckbox,
  BaseCheckboxLabel,
} from '@waveform-playlist/ui-components';
import { useAnnotationOptions, usePlaybackControls } from '@waveform-playlist/browser';

export interface AnnotationCheckboxProps {
  /** On the element that wraps the checkbox and its label. */
  className?: string;
  disabled?: boolean;
  /** The label. Default (also for `null`): the option's English name. */
  children?: React.ReactNode;
}

interface OptionCheckboxProps extends AnnotationCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Class of the input itself (kept from the older checkboxes). */
  inputClassName?: string;
}

const OptionCheckbox: React.FC<OptionCheckboxProps> = ({
  checked,
  onChange,
  inputClassName,
  className,
  disabled,
  children,
}) => {
  // Generated: two of one checkbox on a page must not share an id.
  const id = useId();
  return (
    <BaseCheckboxWrapper className={className}>
      <BaseCheckbox
        type="checkbox"
        id={id}
        className={inputClassName}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <BaseCheckboxLabel htmlFor={id}>{children}</BaseCheckboxLabel>
    </BaseCheckboxWrapper>
  );
};

// In each control the props it was given come first and the bound ones after,
// so a `checked` or `onChange` left over from the controlled form these names
// had before cannot replace the provider's.

/**
 * Shows and sets the provider's `continuousPlay` option: on, playback runs on
 * through the following annotations. Under either playlist provider.
 */
export const ContinuousPlayCheckbox: React.FC<AnnotationCheckboxProps> = ({
  children,
  ...rest
}) => {
  const { continuousPlay } = useAnnotationOptions();
  const { setContinuousPlay } = usePlaybackControls();
  return (
    <OptionCheckbox
      {...rest}
      checked={continuousPlay}
      onChange={setContinuousPlay}
      inputClassName="continuous-play"
    >
      {children ?? 'Continuous Play'}
    </OptionCheckbox>
  );
};

/**
 * Shows and sets the provider's `linkEndpoints` option: on, a dragged edge
 * takes the edge it touches along. Under either playlist provider.
 */
export const LinkEndpointsCheckbox: React.FC<AnnotationCheckboxProps> = ({ children, ...rest }) => {
  const { linkEndpoints } = useAnnotationOptions();
  const { setLinkEndpoints } = usePlaybackControls();
  return (
    <OptionCheckbox
      {...rest}
      checked={linkEndpoints}
      onChange={setLinkEndpoints}
      inputClassName="link-endpoints"
    >
      {children ?? 'Link Endpoints'}
    </OptionCheckbox>
  );
};

/**
 * Shows and sets the provider's `editable` option: whether annotation edges
 * and text can be changed. Under either playlist provider.
 */
export const EditableCheckbox: React.FC<AnnotationCheckboxProps> = ({ children, ...rest }) => {
  const { editable } = useAnnotationOptions();
  const { setAnnotationsEditable } = usePlaybackControls();
  return (
    <OptionCheckbox {...rest} checked={editable} onChange={setAnnotationsEditable}>
      {children ?? 'Editable Annotations'}
    </OptionCheckbox>
  );
};
