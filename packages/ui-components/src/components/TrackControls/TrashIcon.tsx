import React from 'react';
import { Trash, type IconProps } from '@phosphor-icons/react';

export const TrashIcon: React.FC<IconProps> = (props) => (
  <Trash weight="light" {...props} />
);
