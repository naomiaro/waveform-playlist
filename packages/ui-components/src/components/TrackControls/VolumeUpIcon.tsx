import styled from 'styled-components';
import { faVolumeUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon, type FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import type React from 'react';

export const VolumeUpIcon: React.FC<Omit<FontAwesomeIconProps, 'icon'>> = styled(FontAwesomeIcon).attrs({
  icon: faVolumeUp,
})``;
