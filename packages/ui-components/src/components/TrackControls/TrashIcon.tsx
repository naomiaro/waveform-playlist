import React from 'react';
import { TrashIcon as PhosphorTrashIcon, type IconProps } from '@phosphor-icons/react';

export const TrashIcon: React.FC<IconProps> = (props) => (
  <PhosphorTrashIcon weight="light" {...props} />
);
