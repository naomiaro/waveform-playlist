import React from 'react';
import { TrashIcon as PhosphorTrashIcon } from '@phosphor-icons/react/dist/csr/Trash';
import type { IconProps } from '@phosphor-icons/react';

export const TrashIcon: React.FC<IconProps> = (props) => (
  <PhosphorTrashIcon weight="light" {...props} />
);
