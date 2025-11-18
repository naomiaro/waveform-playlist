import styled from 'styled-components';

export const VolumeSlider = styled.input.attrs({
  type: 'range',
})`
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;

  &::-webkit-slider-runnable-track {
    height: 8px;
    background: #ddd;
    border: none;
    border-radius: 3px;
    padding: 1px;
  }

  &::-moz-range-track {
    height: 8px;
    background: #ddd;
    border: none;
    border-radius: 3px;
    padding: 1px;
  }

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;

    border: none;
    height: 16px;
    width: 16px;
    border-radius: 50%;
    background: goldenrod;
    margin-top: -5px;
    cursor: ew-resize;
  }

  &::-moz-range-thumb {
    border: none;
    height: 16px;
    width: 16px;
    border-radius: 50%;
    background: goldenrod;
    margin-top: -5px;
    cursor: ew-resize;
  }

  &:focus {
    outline: none;
  }

  &:focus::-webkit-slider-runnable-track {
    background: #bbb;
  }

  &:focus::-moz-range-track {
    background: #bbb;
  }
`;
