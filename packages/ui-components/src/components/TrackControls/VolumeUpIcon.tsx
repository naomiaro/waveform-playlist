import styled from 'styled-components';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faVolumeUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

library.add(faVolumeUp);

export const VolumeUpIcon = styled(FontAwesomeIcon).attrs({
  icon: 'volume-up',
})``;
