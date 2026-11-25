import React from 'react';
import { DotsSixVerticalIcon } from '@phosphor-icons/react/dist/csr/DotsSixVertical';
import type { IconProps } from '@phosphor-icons/react';

export const GripIcon: React.FC<IconProps> = (props) => (
  <DotsSixVerticalIcon weight="bold" {...props} />
);
