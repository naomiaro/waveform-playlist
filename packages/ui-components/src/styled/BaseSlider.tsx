import styled from 'styled-components';

/**
 * BaseSlider - Themed range input for volume controls, etc.
 *
 * Uses theme values for consistent styling across light/dark modes.
 * Provides custom styling for the track and thumb.
 */
export const BaseSlider = styled.input.attrs({ type: 'range' })`
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  background: ${(props) => props.theme.sliderTrackColor};
  border-radius: 3px;
  cursor: pointer;
  outline: none;

  /* WebKit (Chrome, Safari) */
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    background: ${(props) => props.theme.sliderThumbColor};
    border: 2px solid ${(props) => props.theme.inputBackground};
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  &::-webkit-slider-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  /* Firefox */
  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: ${(props) => props.theme.sliderThumbColor};
    border: 2px solid ${(props) => props.theme.inputBackground};
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  &::-moz-range-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  &::-moz-range-track {
    background: ${(props) => props.theme.sliderTrackColor};
    border-radius: 3px;
    height: 6px;
  }

  &:focus {
    outline: none;
  }

  &:focus::-webkit-slider-thumb {
    box-shadow: 0 0 0 3px ${(props) => props.theme.inputFocusBorder}33;
  }

  &:focus::-moz-range-thumb {
    box-shadow: 0 0 0 3px ${(props) => props.theme.inputFocusBorder}33;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &:disabled::-webkit-slider-thumb {
    cursor: not-allowed;
  }

  &:disabled::-moz-range-thumb {
    cursor: not-allowed;
  }
`;
