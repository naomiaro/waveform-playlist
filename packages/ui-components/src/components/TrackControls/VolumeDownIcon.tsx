import styled from 'styled-components';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faVolumeDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

library.add(faVolumeDown);

export const VolumeDownIcon = styled(FontAwesomeIcon).attrs({
  icon: 'volume-down',
})``;
