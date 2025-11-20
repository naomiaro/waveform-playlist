import styled from 'styled-components';

export const Slider = styled.input.attrs({
  type: 'range',
})`
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  display: inline-block;
  width: 75%;

  &::-webkit-slider-runnable-track {
    height: 5px;
    background: #ddd;
    border: none;
    border-radius: 3px;
  }

  &::-moz-range-track {
    height: 5px;
    background: #ddd;
    border: none;
    border-radius: 3px;
  }

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    border: none;
    height: 12px;
    width: 12px;
    border-radius: 50%;
    background: goldenrod;
    margin-top: -5px;
    cursor: ew-resize;
  }

  &::-moz-range-thumb {
    border: none;
    height: 12px;
    width: 12px;
    border-radius: 50%;
    background: goldenrod;
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

  &:focus::-webkit-slider-thumb {
    border: 2px solid black;
  }

  &:focus::-moz-range-thumb {
    border: 2px solid black;
  }
`;
