import styled from 'styled-components';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

library.add(faTrashAlt);

export const TrashIcon = styled(FontAwesomeIcon).attrs({
  icon: 'trash-alt',
})``;
