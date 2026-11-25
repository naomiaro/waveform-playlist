import React from 'react';
import { SpeakerLowIcon } from '@phosphor-icons/react/dist/csr/SpeakerLow';
import type { IconProps } from '@phosphor-icons/react';

export const VolumeDownIcon: React.FC<IconProps> = (props) => (
  <SpeakerLowIcon weight="light" {...props} />
);
