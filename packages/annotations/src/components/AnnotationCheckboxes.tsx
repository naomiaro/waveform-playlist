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
  /** The label. Default: the option's English name. */
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
      />
      <BaseCheckboxLabel htmlFor={id}>{children}</BaseCheckboxLabel>
    </BaseCheckboxWrapper>
  );
};

/**
 * Shows and sets the provider's `continuousPlay` option: on, playback runs on
 * through the following annotations. Under either playlist provider.
 */
export const ContinuousPlayCheckbox: React.FC<AnnotationCheckboxProps> = ({
  className,
  children = 'Continuous Play',
}) => {
  const { continuousPlay } = useAnnotationOptions();
  const { setContinuousPlay } = usePlaybackControls();
  return (
    <OptionCheckbox
      checked={continuousPlay}
      onChange={setContinuousPlay}
      inputClassName="continuous-play"
      className={className}
    >
      {children}
    </OptionCheckbox>
  );
};

/**
 * Shows and sets the provider's `linkEndpoints` option: on, a dragged edge
 * takes the edge it touches along. Under either playlist provider.
 */
export const LinkEndpointsCheckbox: React.FC<AnnotationCheckboxProps> = ({
  className,
  children = 'Link Endpoints',
}) => {
  const { linkEndpoints } = useAnnotationOptions();
  const { setLinkEndpoints } = usePlaybackControls();
  return (
    <OptionCheckbox
      checked={linkEndpoints}
      onChange={setLinkEndpoints}
      inputClassName="link-endpoints"
      className={className}
    >
      {children}
    </OptionCheckbox>
  );
};

/**
 * Shows and sets the provider's `editable` option: whether annotation edges
 * and text can be changed. Under either playlist provider.
 */
export const EditableCheckbox: React.FC<AnnotationCheckboxProps> = ({
  className,
  children = 'Editable Annotations',
}) => {
  const { editable } = useAnnotationOptions();
  const { setAnnotationsEditable } = usePlaybackControls();
  return (
    <OptionCheckbox checked={editable} onChange={setAnnotationsEditable} className={className}>
      {children}
    </OptionCheckbox>
  );
};
