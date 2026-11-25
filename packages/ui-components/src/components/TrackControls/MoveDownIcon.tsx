import React from 'react';
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown';
import type { IconProps } from '@phosphor-icons/react';

export const MoveDownIcon: React.FC<IconProps> = (props) => (
  <CaretDownIcon weight="bold" {...props} />
);
