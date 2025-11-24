import styled from 'styled-components';
import { BaseSlider } from '../../styled/index';

/**
 * TrackControls Slider - Compact slider for volume/pan controls
 *
 * Extends BaseSlider with track-specific styling:
 * - Smaller thumb and track for compact layout
 * - Uses theme's sliderThumbColor (goldenrod by default)
 */
export const Slider = styled(BaseSlider)`
  width: 75%;
  height: 5px;
  background: ${(props) => props.theme.sliderTrackColor};

  &::-webkit-slider-thumb {
    width: 12px;
    height: 12px;
    background: ${(props) => props.theme.sliderThumbColor};
    border: none;
    margin-top: -4px;
    cursor: ew-resize;
  }

  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background: ${(props) => props.theme.sliderThumbColor};
    border: none;
    cursor: ew-resize;
  }

  &::-webkit-slider-runnable-track {
    height: 5px;
    background: ${(props) => props.theme.sliderTrackColor};
    border-radius: 3px;
  }

  &::-moz-range-track {
    height: 5px;
    background: ${(props) => props.theme.sliderTrackColor};
    border-radius: 3px;
  }

  &:focus::-webkit-slider-runnable-track {
    background: ${(props) => props.theme.inputBorder};
  }

  &:focus::-moz-range-track {
    background: ${(props) => props.theme.inputBorder};
  }

  &:focus::-webkit-slider-thumb {
    border: 2px solid ${(props) => props.theme.textColor};
  }

  &:focus::-moz-range-thumb {
    border: 2px solid ${(props) => props.theme.textColor};
  }
`;
