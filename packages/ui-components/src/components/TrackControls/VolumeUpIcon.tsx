import React from 'react';
import { SpeakerHighIcon } from '@phosphor-icons/react/dist/csr/SpeakerHigh';
import type { IconProps } from '@phosphor-icons/react';

export const VolumeUpIcon: React.FC<IconProps> = (props) => (
  <SpeakerHighIcon weight="light" {...props} />
);
