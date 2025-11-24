import styled from 'styled-components';
import { faVolumeDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon, type FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import type React from 'react';

export const VolumeDownIcon: React.FC<Omit<FontAwesomeIconProps, 'icon'>> = styled(FontAwesomeIcon).attrs({
  icon: faVolumeDown,
})``;
