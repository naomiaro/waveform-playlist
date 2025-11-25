// src/components/AudioPosition.tsx
import styled from "styled-components";
import { jsx } from "react/jsx-runtime";
var PositionDisplay = styled.span`
  font-family: 'Courier New', Monaco, monospace;
  font-size: 1rem;
  font-weight: 600;
  color: ${(props) => props.theme?.textColor || "#333"};
  user-select: none;
`;
var AudioPosition = ({
  formattedTime,
  className
}) => {
  return /* @__PURE__ */ jsx(PositionDisplay, { className, "aria-label": "Audio position", children: formattedTime });
};

// src/styled/BaseButton.tsx
import styled2 from "styled-components";
var BaseButton = styled2.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.theme.fontSize};
  font-weight: 500;
  color: ${(props) => props.theme.buttonText};
  background-color: ${(props) => props.theme.buttonBackground};
  border: 1px solid ${(props) => props.theme.buttonBorder};
  border-radius: ${(props) => props.theme.borderRadius};
  cursor: pointer;
  outline: none;
  transition: background-color 0.15s ease-in-out, border-color 0.15s ease-in-out,
    box-shadow 0.15s ease-in-out;

  &:hover:not(:disabled) {
    background-color: ${(props) => props.theme.buttonHoverBackground};
  }

  &:focus {
    box-shadow: 0 0 0 2px ${(props) => props.theme.inputFocusBorder}33;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
var BaseButtonSmall = styled2(BaseButton)`
  padding: 0.25rem 0.5rem;
  font-size: ${(props) => props.theme.fontSizeSmall};
`;
var IconButton = styled2(BaseButton)`
  padding: 0.5rem;
  min-width: 2.25rem;
  min-height: 2.25rem;
`;
var IconButtonSmall = styled2(BaseButton)`
  padding: 0.25rem;
  min-width: 1.75rem;
  min-height: 1.75rem;
  font-size: ${(props) => props.theme.fontSizeSmall};
`;

// src/styled/BaseCheckbox.tsx
import styled3 from "styled-components";
var BaseCheckboxWrapper = styled3.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`;
var BaseCheckbox = styled3.input`
  cursor: pointer;
  accent-color: ${(props) => props.theme.inputFocusBorder};

  &:disabled {
    cursor: not-allowed;
  }
`;
var BaseCheckboxLabel = styled3.label`
  margin: 0;
  cursor: pointer;
  user-select: none;
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.theme.fontSize};
  color: ${(props) => props.theme.textColor};
`;

// src/styled/BaseControlButton.tsx
import styled4 from "styled-components";
var buttonColors = {
  primary: {
    background: "#007bff",
    hover: "#0056b3"
  },
  success: {
    background: "#28a745",
    hover: "#218838"
  },
  info: {
    background: "#17a2b8",
    hover: "#138496"
  }
};
var BaseControlButton = styled4.button`
  padding: 0.5rem 1rem;
  background: ${(props) => buttonColors[props.variant || "primary"].background};
  color: white;
  border: none;
  border-radius: ${(props) => props.theme.borderRadius};
  cursor: pointer;
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.theme.fontSize};
  font-weight: ${(props) => props.variant === "info" ? "600" : "500"};
  transition: background-color 0.15s ease-in-out;

  &:hover:not(:disabled) {
    background: ${(props) => buttonColors[props.variant || "primary"].hover};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${(props) => buttonColors[props.variant || "primary"].background}66;
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

// src/styled/BaseInput.tsx
import styled5 from "styled-components";
var BaseInput = styled5.input`
  padding: 0.5rem 0.75rem;
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.theme.fontSize};
  color: ${(props) => props.theme.inputText};
  background-color: ${(props) => props.theme.inputBackground};
  border: 1px solid ${(props) => props.theme.inputBorder};
  border-radius: ${(props) => props.theme.borderRadius};
  outline: none;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;

  &::placeholder {
    color: ${(props) => props.theme.inputPlaceholder};
  }

  &:focus {
    border-color: ${(props) => props.theme.inputFocusBorder};
    box-shadow: 0 0 0 2px ${(props) => props.theme.inputFocusBorder}33;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
var BaseInputSmall = styled5(BaseInput)`
  padding: 0.25rem 0.5rem;
  font-size: ${(props) => props.theme.fontSizeSmall};
`;

// src/styled/BaseLabel.tsx
import styled6 from "styled-components";
var BaseLabel = styled6.label`
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.theme.fontSizeSmall};
  font-weight: 500;
  color: ${(props) => props.theme.textColorMuted};
  margin-bottom: 0.25rem;
  display: block;
`;
var InlineLabel = styled6.label`
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.theme.fontSize};
  color: ${(props) => props.theme.textColor};
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
`;
var ScreenReaderOnly = styled6.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

// src/styled/BaseSelect.tsx
import styled7 from "styled-components";
var BaseSelect = styled7.select`
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.theme.fontSize};
  color: ${(props) => props.theme.inputText};
  background-color: ${(props) => props.theme.inputBackground};
  border: 1px solid ${(props) => props.theme.inputBorder};
  border-radius: ${(props) => props.theme.borderRadius};
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;

  &:focus {
    border-color: ${(props) => props.theme.inputFocusBorder};
    box-shadow: 0 0 0 2px ${(props) => props.theme.inputFocusBorder}33;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Style native option elements for dark mode support */
  option {
    color: ${(props) => props.theme.inputText};
    background-color: ${(props) => props.theme.inputBackground};
  }
`;
var BaseSelectSmall = styled7(BaseSelect)`
  padding: 0.25rem 1.75rem 0.25rem 0.5rem;
  font-size: ${(props) => props.theme.fontSizeSmall};
`;

// src/styled/BaseSlider.tsx
import styled8 from "styled-components";
var BaseSlider = styled8.input.attrs({ type: "range" })`
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

// src/components/AutomaticScrollCheckbox.tsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
var AutomaticScrollCheckbox = ({
  checked,
  onChange,
  disabled = false,
  className
}) => {
  const handleChange = (e) => {
    onChange(e.target.checked);
  };
  return /* @__PURE__ */ jsxs(BaseCheckboxWrapper, { className, children: [
    /* @__PURE__ */ jsx2(
      BaseCheckbox,
      {
        type: "checkbox",
        id: "automatic-scroll",
        className: "automatic-scroll",
        checked,
        onChange: handleChange,
        disabled
      }
    ),
    /* @__PURE__ */ jsx2(BaseCheckboxLabel, { htmlFor: "automatic-scroll", children: "Automatic Scroll" })
  ] });
};

// src/components/Channel.tsx
import { useLayoutEffect, useCallback, useRef } from "react";
import styled9 from "styled-components";
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
var MAX_CANVAS_WIDTH = 1e3;
var Progress = styled9.div.attrs((props) => ({
  style: {
    width: `${props.$progress}px`,
    height: `${props.$waveHeight}px`
  }
}))`
  position: absolute;
  background: ${(props) => props.$waveProgressColor};
`;
var Waveform = styled9.canvas.attrs((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    height: `${props.$waveHeight}px`
  }
}))`
  float: left;
  position: relative;
`;
var Wrapper = styled9.div.attrs((props) => ({
  style: {
    top: `${props.$waveHeight * props.$index}px`,
    width: `${props.$cssWidth}px`,
    height: `${props.$waveHeight}px`
  }
}))`
  position: absolute;
  background: ${(props) => props.$waveFillColor};
`;
var Channel = (props) => {
  const {
    data,
    bits,
    length,
    index,
    className,
    progress = 0,
    devicePixelRatio = 1,
    waveHeight = 80,
    waveProgressColor = "orange",
    waveOutlineColor = "#E0EFF1",
    waveFillColor = "grey"
  } = props;
  const canvasesRef = useRef([]);
  const canvasRef = useCallback(
    (canvas) => {
      if (canvas !== null) {
        const index2 = parseInt(canvas.dataset.index, 10);
        canvasesRef.current[index2] = canvas;
      }
    },
    []
  );
  useLayoutEffect(() => {
    const canvases = canvasesRef.current;
    let offset = 0;
    for (let i = 0; i < canvases.length; i++) {
      const canvas = canvases[i];
      const ctx = canvas.getContext("2d");
      const h2 = Math.floor(waveHeight / 2);
      const maxValue = 2 ** (bits - 1);
      if (ctx) {
        ctx.resetTransform();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = waveOutlineColor;
        ctx.scale(devicePixelRatio, devicePixelRatio);
        const peakSegmentLength = canvas.width / devicePixelRatio;
        for (let i2 = 0; i2 < peakSegmentLength; i2 += 1) {
          const minPeak = data[(i2 + offset) * 2] / maxValue;
          const maxPeak = data[(i2 + offset) * 2 + 1] / maxValue;
          const min = Math.abs(minPeak * h2);
          const max = Math.abs(maxPeak * h2);
          ctx.fillRect(i2, 0, 1, h2 - max);
          ctx.fillRect(i2, h2 + min, 1, h2 - min);
        }
      }
      offset += MAX_CANVAS_WIDTH;
    }
  }, [
    data,
    bits,
    waveHeight,
    waveOutlineColor,
    devicePixelRatio,
    length
  ]);
  let totalWidth = length;
  let waveformCount = 0;
  const waveforms = [];
  while (totalWidth > 0) {
    const currentWidth = Math.min(totalWidth, MAX_CANVAS_WIDTH);
    const waveform = /* @__PURE__ */ jsx3(
      Waveform,
      {
        $cssWidth: currentWidth,
        width: currentWidth * devicePixelRatio,
        height: waveHeight * devicePixelRatio,
        $waveHeight: waveHeight,
        "data-index": waveformCount,
        ref: canvasRef
      },
      `${length}-${waveformCount}`
    );
    waveforms.push(waveform);
    totalWidth -= currentWidth;
    waveformCount += 1;
  }
  return /* @__PURE__ */ jsxs2(
    Wrapper,
    {
      $index: index,
      $cssWidth: length,
      className,
      $waveHeight: waveHeight,
      $waveFillColor: waveFillColor,
      children: [
        /* @__PURE__ */ jsx3(
          Progress,
          {
            $progress: progress,
            $waveHeight: waveHeight,
            $waveProgressColor: waveProgressColor
          }
        ),
        waveforms
      ]
    }
  );
};

// src/components/Clip.tsx
import styled12 from "styled-components";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

// src/components/ClipHeader.tsx
import styled10 from "styled-components";
import { jsx as jsx4 } from "react/jsx-runtime";
var CLIP_HEADER_HEIGHT = 22;
var HeaderContainer = styled10.div`
  position: relative;
  height: ${CLIP_HEADER_HEIGHT}px;
  background: ${(props) => props.$isSelected ? props.theme.selectedClipHeaderBackgroundColor : props.theme.clipHeaderBackgroundColor};
  border-bottom: 1px solid ${(props) => props.theme.clipHeaderBorderColor};
  display: flex;
  align-items: center;
  padding: 0 8px;
  cursor: ${(props) => props.$interactive ? props.$isDragging ? "grabbing" : "grab" : "default"};
  user-select: none;
  z-index: 110;
  flex-shrink: 0;

  ${(props) => props.$interactive && `
    &:hover {
      background: ${props.theme.clipHeaderBackgroundColor}dd;
    }

    &:active {
      cursor: grabbing;
    }
  `}
`;
var TrackName = styled10.span`
  font-size: 11px;
  font-weight: 600;
  color: ${(props) => props.theme.clipHeaderTextColor};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
var ClipHeaderPresentational = ({
  trackName,
  isSelected = false
}) => {
  return /* @__PURE__ */ jsx4(
    HeaderContainer,
    {
      $isDragging: false,
      $interactive: false,
      $isSelected: isSelected,
      children: /* @__PURE__ */ jsx4(TrackName, { children: trackName })
    }
  );
};
var ClipHeader = ({
  clipId,
  trackIndex,
  clipIndex,
  trackName,
  isSelected = false,
  disableDrag = false,
  dragHandleProps
}) => {
  if (disableDrag || !dragHandleProps) {
    return /* @__PURE__ */ jsx4(
      ClipHeaderPresentational,
      {
        trackName,
        isSelected
      }
    );
  }
  const { attributes, listeners, setActivatorNodeRef } = dragHandleProps;
  return /* @__PURE__ */ jsx4(
    HeaderContainer,
    {
      ref: setActivatorNodeRef,
      "data-clip-id": clipId,
      $interactive: true,
      $isSelected: isSelected,
      ...listeners,
      ...attributes,
      children: /* @__PURE__ */ jsx4(TrackName, { children: trackName })
    }
  );
};

// src/components/ClipBoundary.tsx
import React2 from "react";
import styled11 from "styled-components";
import { jsx as jsx5 } from "react/jsx-runtime";
var CLIP_BOUNDARY_WIDTH = 8;
var BoundaryContainer = styled11.div`
  position: absolute;
  ${(props) => props.$edge}: 0;
  top: 0;
  bottom: 0;
  width: ${CLIP_BOUNDARY_WIDTH}px;
  cursor: col-resize;
  user-select: none;
  z-index: 105; /* Above waveform, below header */

  /* Invisible by default, visible on hover */
  background: ${(props) => props.$isDragging ? "rgba(255, 255, 255, 0.4)" : props.$isHovered ? "rgba(255, 255, 255, 0.2)" : "transparent"};

  border-${(props) => props.$edge}: 2px solid ${(props) => props.$isDragging ? "rgba(255, 255, 255, 0.8)" : props.$isHovered ? "rgba(255, 255, 255, 0.5)" : "transparent"};

  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-${(props) => props.$edge}: 2px solid rgba(255, 255, 255, 0.5);
  }

  &:active {
    background: rgba(255, 255, 255, 0.4);
    border-${(props) => props.$edge}: 2px solid rgba(255, 255, 255, 0.8);
  }
`;
var ClipBoundary = ({
  clipId,
  trackIndex,
  clipIndex,
  edge,
  dragHandleProps
}) => {
  const [isHovered, setIsHovered] = React2.useState(false);
  if (!dragHandleProps) {
    return null;
  }
  const { attributes, listeners, setActivatorNodeRef, isDragging } = dragHandleProps;
  return /* @__PURE__ */ jsx5(
    BoundaryContainer,
    {
      ref: setActivatorNodeRef,
      "data-clip-id": clipId,
      "data-boundary-edge": edge,
      $edge: edge,
      $isDragging: isDragging,
      $isHovered: isHovered,
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => setIsHovered(false),
      ...listeners,
      ...attributes
    }
  );
};

// src/components/Clip.tsx
import { Fragment, jsx as jsx6, jsxs as jsxs3 } from "react/jsx-runtime";
var ClipContainer = styled12.div.attrs((props) => ({
  style: props.$isOverlay ? {} : {
    left: `${props.$left}px`,
    width: `${props.$width}px`
  }
}))`
  position: ${(props) => props.$isOverlay ? "relative" : "absolute"};
  top: 0;
  height: ${(props) => props.$isOverlay ? "auto" : "100%"};
  width: ${(props) => props.$isOverlay ? `${props.$width}px` : "auto"};
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.05);
  cursor: crosshair; /* Indicates that pressing 'S' will split the clip */

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
`;
var ChannelsWrapper = styled12.div`
  flex: 1;
  position: relative;
  overflow: ${(props) => props.$isOverlay ? "visible" : "hidden"};
`;
var Clip = ({
  children,
  className,
  clipId,
  trackIndex,
  clipIndex,
  trackName,
  startSample,
  durationSamples,
  samplesPerPixel,
  showHeader = false,
  disableHeaderDrag = false,
  isOverlay = false,
  isSelected = false,
  onMouseDown,
  trackId
}) => {
  const left = Math.floor(startSample / samplesPerPixel);
  const endPixel = Math.floor((startSample + durationSamples) / samplesPerPixel);
  const width = endPixel - left;
  const enableDrag = showHeader && !disableHeaderDrag && !isOverlay;
  const draggableId = `clip-${trackIndex}-${clipIndex}`;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: { clipId, trackIndex, clipIndex },
    disabled: !enableDrag
  });
  const leftBoundaryId = `clip-boundary-left-${trackIndex}-${clipIndex}`;
  const {
    attributes: leftBoundaryAttributes,
    listeners: leftBoundaryListeners,
    setActivatorNodeRef: setLeftBoundaryActivatorRef,
    isDragging: isLeftBoundaryDragging
  } = useDraggable({
    id: leftBoundaryId,
    data: { clipId, trackIndex, clipIndex, boundary: "left" },
    disabled: !enableDrag
  });
  const rightBoundaryId = `clip-boundary-right-${trackIndex}-${clipIndex}`;
  const {
    attributes: rightBoundaryAttributes,
    listeners: rightBoundaryListeners,
    setActivatorNodeRef: setRightBoundaryActivatorRef,
    isDragging: isRightBoundaryDragging
  } = useDraggable({
    id: rightBoundaryId,
    data: { clipId, trackIndex, clipIndex, boundary: "right" },
    disabled: !enableDrag
  });
  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 100 : void 0
    // Below controls (z-index: 999) but above other clips
  } : void 0;
  return /* @__PURE__ */ jsxs3(
    ClipContainer,
    {
      ref: setNodeRef,
      style,
      className,
      $left: left,
      $width: width,
      $isOverlay: isOverlay,
      "data-clip-container": "true",
      "data-track-id": trackId,
      onMouseDown,
      children: [
        showHeader && /* @__PURE__ */ jsx6(
          ClipHeader,
          {
            clipId,
            trackIndex,
            clipIndex,
            trackName,
            isSelected,
            disableDrag: disableHeaderDrag,
            dragHandleProps: enableDrag ? { attributes, listeners, setActivatorNodeRef } : void 0
          }
        ),
        /* @__PURE__ */ jsxs3(ChannelsWrapper, { $isOverlay: isOverlay, children: [
          children,
          showHeader && !disableHeaderDrag && !isOverlay && /* @__PURE__ */ jsxs3(Fragment, { children: [
            /* @__PURE__ */ jsx6(
              ClipBoundary,
              {
                clipId,
                trackIndex,
                clipIndex,
                edge: "left",
                dragHandleProps: {
                  attributes: leftBoundaryAttributes,
                  listeners: leftBoundaryListeners,
                  setActivatorNodeRef: setLeftBoundaryActivatorRef,
                  isDragging: isLeftBoundaryDragging
                }
              }
            ),
            /* @__PURE__ */ jsx6(
              ClipBoundary,
              {
                clipId,
                trackIndex,
                clipIndex,
                edge: "right",
                dragHandleProps: {
                  attributes: rightBoundaryAttributes,
                  listeners: rightBoundaryListeners,
                  setActivatorNodeRef: setRightBoundaryActivatorRef,
                  isDragging: isRightBoundaryDragging
                }
              }
            )
          ] })
        ] })
      ]
    }
  );
};

// src/components/MasterVolumeControl.tsx
import styled13 from "styled-components";
import { jsx as jsx7, jsxs as jsxs4 } from "react/jsx-runtime";
var VolumeContainer = styled13.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`;
var VolumeLabel = styled13(BaseLabel)`
  margin: 0;
  white-space: nowrap;
`;
var VolumeSlider = styled13(BaseSlider)`
  width: 120px;
`;
var MasterVolumeControl = ({
  volume,
  onChange,
  disabled = false,
  className
}) => {
  const handleChange = (e) => {
    onChange(parseFloat(e.target.value) / 100);
  };
  return /* @__PURE__ */ jsxs4(VolumeContainer, { className, children: [
    /* @__PURE__ */ jsx7(VolumeLabel, { htmlFor: "master-gain", children: "Master Volume" }),
    /* @__PURE__ */ jsx7(
      VolumeSlider,
      {
        min: "0",
        max: "100",
        value: volume * 100,
        onChange: handleChange,
        disabled,
        id: "master-gain"
      }
    )
  ] });
};

// src/components/Playhead.tsx
import styled14 from "styled-components";
import { jsx as jsx8 } from "react/jsx-runtime";
var PlayheadLine = styled14.div.attrs((props) => ({
  style: {
    transform: `translate3d(${props.$position}px, 0, 0)`
  }
}))`
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  background: ${(props) => props.$color};
  height: 100%;
  z-index: 150;
  pointer-events: none;
  will-change: transform;
`;
var Playhead = ({ position, color = "#ff0000" }) => {
  return /* @__PURE__ */ jsx8(PlayheadLine, { $position: position, $color: color });
};

// src/components/Playlist.tsx
import styled15, { withTheme } from "styled-components";
import { jsx as jsx9, jsxs as jsxs5 } from "react/jsx-runtime";
var Wrapper2 = styled15.div`
  overflow-y: hidden;
  overflow-x: auto;
  position: relative;
`;
var ScrollContainer = styled15.div`
  position: relative;
  background: ${(props) => props.$backgroundColor || "transparent"};
  ${(props) => props.$width !== void 0 && `width: ${props.$width}px;`}
`;
var TimescaleWrapper = styled15.div`
  background: ${(props) => props.$backgroundColor || "white"};
  ${(props) => props.$width && `min-width: ${props.$width}px;`}
  width: 100%;
  overflow: visible;
`;
var TracksContainer = styled15.div`
  position: relative;
  background: ${(props) => props.$backgroundColor || "transparent"};
  ${(props) => props.$width !== void 0 && `min-width: ${props.$width}px;`}
  width: 100%;
`;
var ClickOverlay = styled15.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  cursor: crosshair;
  z-index: 100;
`;
var Playlist = ({
  children,
  backgroundColor,
  timescaleBackgroundColor,
  timescale,
  timescaleWidth,
  tracksWidth,
  scrollContainerWidth,
  controlsWidth,
  onTracksClick,
  onTracksMouseDown,
  onTracksMouseMove,
  onTracksMouseUp,
  scrollContainerRef
}) => {
  return /* @__PURE__ */ jsx9(Wrapper2, { "data-scroll-container": "true", ref: scrollContainerRef, children: /* @__PURE__ */ jsxs5(
    ScrollContainer,
    {
      $backgroundColor: backgroundColor,
      $width: scrollContainerWidth,
      children: [
        timescale && /* @__PURE__ */ jsx9(TimescaleWrapper, { $width: timescaleWidth, $backgroundColor: timescaleBackgroundColor, children: timescale }),
        /* @__PURE__ */ jsxs5(TracksContainer, { $width: tracksWidth, $backgroundColor: backgroundColor, children: [
          children,
          (onTracksClick || onTracksMouseDown) && /* @__PURE__ */ jsx9(
            ClickOverlay,
            {
              $controlsWidth: controlsWidth,
              onClick: onTracksClick,
              onMouseDown: onTracksMouseDown,
              onMouseMove: onTracksMouseMove,
              onMouseUp: onTracksMouseUp
            }
          )
        ] })
      ]
    }
  ) });
};
var StyledPlaylist = withTheme(Playlist);

// src/components/Selection.tsx
import styled16 from "styled-components";
import { jsx as jsx10 } from "react/jsx-runtime";
var SelectionOverlay = styled16.div.attrs((props) => ({
  style: {
    left: `${props.$left}px`,
    width: `${props.$width}px`
  }
}))`
  position: absolute;
  top: 0;
  background: ${(props) => props.$color};
  height: 100%;
  z-index: 5;
  pointer-events: none;
  opacity: 0.3;
`;
var Selection = ({
  startPosition,
  endPosition,
  color = "#00ff00"
}) => {
  const width = Math.max(0, endPosition - startPosition);
  if (width <= 0) {
    return null;
  }
  return /* @__PURE__ */ jsx10(SelectionOverlay, { $left: startPosition, $width: width, $color: color });
};

// src/components/SelectionTimeInputs.tsx
import { useEffect as useEffect2, useState as useState2 } from "react";

// src/components/TimeInput.tsx
import { useEffect, useState } from "react";

// src/utils/timeFormat.ts
function clockFormat(seconds, decimals) {
  const hours = Math.floor(seconds / 3600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  const secs = (seconds % 60).toFixed(decimals);
  return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") + ":" + secs.padStart(decimals + 3, "0");
}
function formatTime(seconds, format) {
  switch (format) {
    case "seconds":
      return seconds.toFixed(0);
    case "thousandths":
      return seconds.toFixed(3);
    case "hh:mm:ss":
      return clockFormat(seconds, 0);
    case "hh:mm:ss.u":
      return clockFormat(seconds, 1);
    case "hh:mm:ss.uu":
      return clockFormat(seconds, 2);
    case "hh:mm:ss.uuu":
      return clockFormat(seconds, 3);
    default:
      return clockFormat(seconds, 3);
  }
}
function parseTime(timeStr, format) {
  if (!timeStr) return 0;
  switch (format) {
    case "seconds":
    case "thousandths":
      return parseFloat(timeStr) || 0;
    case "hh:mm:ss":
    case "hh:mm:ss.u":
    case "hh:mm:ss.uu":
    case "hh:mm:ss.uuu": {
      const parts = timeStr.split(":");
      if (parts.length !== 3) return 0;
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      const seconds = parseFloat(parts[2]) || 0;
      return hours * 3600 + minutes * 60 + seconds;
    }
    default:
      return 0;
  }
}

// src/components/TimeInput.tsx
import { Fragment as Fragment2, jsx as jsx11, jsxs as jsxs6 } from "react/jsx-runtime";
var TimeInput = ({
  id,
  label,
  value,
  format,
  className,
  onChange,
  readOnly = false
}) => {
  const [displayValue, setDisplayValue] = useState("");
  useEffect(() => {
    const formatted = formatTime(value, format);
    setDisplayValue(formatted);
  }, [value, format, id]);
  const handleChange = (e) => {
    const newDisplayValue = e.target.value;
    setDisplayValue(newDisplayValue);
  };
  const handleBlur = () => {
    if (onChange) {
      const parsedValue = parseTime(displayValue, format);
      onChange(parsedValue);
    }
    setDisplayValue(formatTime(value, format));
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };
  return /* @__PURE__ */ jsxs6(Fragment2, { children: [
    /* @__PURE__ */ jsx11(ScreenReaderOnly, { as: "label", htmlFor: id, children: label }),
    /* @__PURE__ */ jsx11(
      BaseInput,
      {
        type: "text",
        className,
        id,
        value: displayValue,
        onChange: handleChange,
        onBlur: handleBlur,
        onKeyDown: handleKeyDown,
        readOnly
      }
    )
  ] });
};

// src/components/SelectionTimeInputs.tsx
import { Fragment as Fragment3, jsx as jsx12, jsxs as jsxs7 } from "react/jsx-runtime";
var SelectionTimeInputs = ({
  selectionStart,
  selectionEnd,
  onSelectionChange,
  className
}) => {
  const [timeFormat, setTimeFormat] = useState2("hh:mm:ss.uuu");
  useEffect2(() => {
    const timeFormatSelect = document.querySelector(".time-format");
    const handleFormatChange = () => {
      if (timeFormatSelect) {
        setTimeFormat(timeFormatSelect.value);
      }
    };
    if (timeFormatSelect) {
      setTimeFormat(timeFormatSelect.value);
      timeFormatSelect.addEventListener("change", handleFormatChange);
    }
    return () => {
      timeFormatSelect?.removeEventListener("change", handleFormatChange);
    };
  }, []);
  const handleStartChange = (value) => {
    if (onSelectionChange) {
      onSelectionChange(value, selectionEnd);
    }
  };
  const handleEndChange = (value) => {
    if (onSelectionChange) {
      onSelectionChange(selectionStart, value);
    }
  };
  return /* @__PURE__ */ jsxs7(Fragment3, { children: [
    /* @__PURE__ */ jsx12(
      TimeInput,
      {
        id: "audio_start",
        label: "Start of audio selection",
        value: selectionStart,
        format: timeFormat,
        className: "audio-start form-control mr-sm-2",
        onChange: handleStartChange
      }
    ),
    /* @__PURE__ */ jsx12(
      TimeInput,
      {
        id: "audio_end",
        label: "End of audio selection",
        value: selectionEnd,
        format: timeFormat,
        className: "audio-end form-control mr-sm-2",
        onChange: handleEndChange
      }
    )
  ] });
};

// src/contexts/DevicePixelRatio.tsx
import { useState as useState3, createContext, useContext } from "react";
import { jsx as jsx13 } from "react/jsx-runtime";
function getScale() {
  return window.devicePixelRatio;
}
var DevicePixelRatioContext = createContext(getScale());
var DevicePixelRatioProvider = ({ children }) => {
  const [scale, setScale] = useState3(getScale());
  matchMedia(`(resolution: ${getScale()}dppx)`).addEventListener(
    "change",
    () => {
      setScale(getScale());
    },
    { once: true }
  );
  return /* @__PURE__ */ jsx13(DevicePixelRatioContext.Provider, { value: Math.ceil(scale), children });
};
var useDevicePixelRatio = () => useContext(DevicePixelRatioContext);

// src/contexts/PlaylistInfo.tsx
import { createContext as createContext2, useContext as useContext2 } from "react";
var PlaylistInfoContext = createContext2({
  sampleRate: 48e3,
  samplesPerPixel: 1e3,
  zoomLevels: [1e3, 1500, 2e3, 2500],
  waveHeight: 80,
  timeScaleHeight: 15,
  controls: {
    show: false,
    width: 150
  },
  duration: 3e4
});
var usePlaylistInfo = () => useContext2(PlaylistInfoContext);

// src/contexts/Theme.tsx
import { useContext as useContext3 } from "react";
import { ThemeContext } from "styled-components";
var useTheme = () => useContext3(ThemeContext);

// src/contexts/TrackControls.tsx
import { createContext as createContext3, useContext as useContext4, Fragment as Fragment4 } from "react";
import { jsx as jsx14 } from "react/jsx-runtime";
var TrackControlsContext = createContext3(/* @__PURE__ */ jsx14(Fragment4, {}));
var useTrackControls = () => useContext4(TrackControlsContext);

// src/contexts/Playout.tsx
import {
  useState as useState4,
  createContext as createContext4,
  useContext as useContext5
} from "react";
import { jsx as jsx15 } from "react/jsx-runtime";
var defaultProgress = 0;
var defaultIsPlaying = false;
var defaultSelectionStart = 0;
var defaultSelectionEnd = 0;
var defaultPlayout = {
  progress: defaultProgress,
  isPlaying: defaultIsPlaying,
  selectionStart: defaultSelectionStart,
  selectionEnd: defaultSelectionEnd
};
var PlayoutStatusContext = createContext4(defaultPlayout);
var PlayoutStatusUpdateContext = createContext4({
  setIsPlaying: () => {
  },
  setProgress: () => {
  },
  setSelection: () => {
  }
});
var PlayoutProvider = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState4(defaultIsPlaying);
  const [progress, setProgress] = useState4(defaultProgress);
  const [selectionStart, setSelectionStart] = useState4(defaultSelectionStart);
  const [selectionEnd, setSelectionEnd] = useState4(defaultSelectionEnd);
  const setSelection = (start, end) => {
    setSelectionStart(start);
    setSelectionEnd(end);
  };
  return /* @__PURE__ */ jsx15(PlayoutStatusUpdateContext.Provider, { value: { setIsPlaying, setProgress, setSelection }, children: /* @__PURE__ */ jsx15(PlayoutStatusContext.Provider, { value: { isPlaying, progress, selectionStart, selectionEnd }, children }) });
};
var usePlayoutStatus = () => useContext5(PlayoutStatusContext);
var usePlayoutStatusUpdate = () => useContext5(PlayoutStatusUpdateContext);

// src/components/SmartChannel.tsx
import { jsx as jsx16 } from "react/jsx-runtime";
var SmartChannel = ({ isSelected, ...props }) => {
  const theme = useTheme();
  const { waveHeight } = usePlaylistInfo();
  const devicePixelRatio = useDevicePixelRatio();
  const waveOutlineColor = isSelected && theme ? theme.selectedWaveOutlineColor : theme?.waveOutlineColor;
  const waveFillColor = isSelected && theme ? theme.selectedWaveFillColor : theme?.waveFillColor;
  return /* @__PURE__ */ jsx16(
    Channel,
    {
      ...props,
      ...theme,
      waveOutlineColor,
      waveFillColor,
      waveHeight,
      devicePixelRatio
    }
  );
};

// src/components/SmartScale.tsx
import { useContext as useContext7 } from "react";

// src/components/TimeScale.tsx
import React8, { useRef as useRef2, useEffect as useEffect3, useContext as useContext6 } from "react";
import styled17, { withTheme as withTheme2 } from "styled-components";

// src/utils/conversions.ts
function samplesToSeconds(samples, sampleRate) {
  return samples / sampleRate;
}
function secondsToSamples(seconds, sampleRate) {
  return Math.ceil(seconds * sampleRate);
}
function samplesToPixels(samples, samplesPerPixel) {
  return Math.floor(samples / samplesPerPixel);
}
function pixelsToSamples(pixels, samplesPerPixel) {
  return Math.floor(pixels * samplesPerPixel);
}
function pixelsToSeconds(pixels, samplesPerPixel, sampleRate) {
  return pixels * samplesPerPixel / sampleRate;
}
function secondsToPixels(seconds, samplesPerPixel, sampleRate) {
  return Math.ceil(seconds * sampleRate / samplesPerPixel);
}

// src/components/TimeScale.tsx
import { jsx as jsx17, jsxs as jsxs8 } from "react/jsx-runtime";
function formatTime2(milliseconds) {
  const seconds = Math.floor(milliseconds / 1e3);
  const s = seconds % 60;
  const m = (seconds - s) / 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
var PlaylistTimeScaleScroll = styled17.div.attrs((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    marginLeft: `${props.$controlWidth}px`,
    height: `${props.$timeScaleHeight}px`
  }
}))`
  position: relative;
  overflow: visible; /* Allow time labels to render above the container */
`;
var TimeTicks = styled17.canvas.attrs((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    height: `${props.$timeScaleHeight}px`
  }
}))`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
`;
var TimeStamp = styled17.div.attrs((props) => ({
  style: {
    left: `${props.$left + 4}px`
    // Offset 4px to the right of the tick
  }
}))`
  position: absolute;
  font-size: 0.75rem; /* Smaller font to prevent overflow */
  white-space: nowrap; /* Prevent text wrapping */
  color: ${(props) => props.theme.timeColor}; /* Use theme color instead of inheriting */
`;
var TimeScale = (props) => {
  const {
    theme: { timeColor },
    duration,
    marker,
    bigStep,
    secondStep,
    renderTimestamp
  } = props;
  const canvasInfo = /* @__PURE__ */ new Map();
  const timeMarkers = [];
  const canvasRef = useRef2(null);
  const {
    sampleRate,
    samplesPerPixel,
    timeScaleHeight,
    controls: { show: showControls, width: controlWidth }
  } = useContext6(PlaylistInfoContext);
  const devicePixelRatio = useDevicePixelRatio();
  useEffect3(() => {
    if (canvasRef.current !== null) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.resetTransform();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = timeColor;
        ctx.scale(devicePixelRatio, devicePixelRatio);
        for (const [pixLeft, scaleHeight] of canvasInfo.entries()) {
          const scaleY = timeScaleHeight - scaleHeight;
          ctx.fillRect(pixLeft, scaleY, 1, scaleHeight);
        }
      }
    }
  }, [
    duration,
    devicePixelRatio,
    timeColor,
    timeScaleHeight,
    bigStep,
    secondStep,
    marker,
    canvasInfo
  ]);
  const widthX = secondsToPixels(duration / 1e3, samplesPerPixel, sampleRate);
  const pixPerSec = sampleRate / samplesPerPixel;
  let counter = 0;
  for (let i = 0; i < widthX; i += pixPerSec * secondStep / 1e3) {
    const pix = Math.floor(i);
    if (counter % marker === 0) {
      const timeMs = counter;
      const timestamp = formatTime2(timeMs);
      const timestampContent = renderTimestamp ? /* @__PURE__ */ jsx17(React8.Fragment, { children: renderTimestamp(timeMs, pix) }, `timestamp-${counter}`) : /* @__PURE__ */ jsx17(TimeStamp, { $left: pix, children: timestamp }, timestamp);
      timeMarkers.push(timestampContent);
      canvasInfo.set(pix, timeScaleHeight);
    } else if (counter % bigStep === 0) {
      canvasInfo.set(pix, Math.floor(timeScaleHeight / 2));
    } else if (counter % secondStep === 0) {
      canvasInfo.set(pix, Math.floor(timeScaleHeight / 5));
    }
    counter += secondStep;
  }
  return /* @__PURE__ */ jsxs8(
    PlaylistTimeScaleScroll,
    {
      $cssWidth: widthX,
      $controlWidth: showControls ? controlWidth : 0,
      $timeScaleHeight: timeScaleHeight,
      children: [
        timeMarkers,
        /* @__PURE__ */ jsx17(
          TimeTicks,
          {
            $cssWidth: widthX,
            $timeScaleHeight: timeScaleHeight,
            width: widthX * devicePixelRatio,
            height: timeScaleHeight * devicePixelRatio,
            ref: canvasRef
          }
        )
      ]
    }
  );
};
var StyledTimeScale = withTheme2(TimeScale);

// src/components/SmartScale.tsx
import { jsx as jsx18 } from "react/jsx-runtime";
var timeinfo = /* @__PURE__ */ new Map([
  [
    700,
    {
      marker: 1e3,
      bigStep: 500,
      smallStep: 100
    }
  ],
  [
    1500,
    {
      marker: 2e3,
      bigStep: 1e3,
      smallStep: 200
    }
  ],
  [
    2500,
    {
      marker: 2e3,
      bigStep: 1e3,
      smallStep: 500
    }
  ],
  [
    5e3,
    {
      marker: 5e3,
      bigStep: 1e3,
      smallStep: 500
    }
  ],
  [
    1e4,
    {
      marker: 1e4,
      bigStep: 5e3,
      smallStep: 1e3
    }
  ],
  [
    12e3,
    {
      marker: 15e3,
      bigStep: 5e3,
      smallStep: 1e3
    }
  ],
  [
    Infinity,
    {
      marker: 3e4,
      bigStep: 1e4,
      smallStep: 5e3
    }
  ]
]);
function getScaleInfo(samplesPerPixel) {
  const keys = timeinfo.keys();
  let config;
  for (const resolution of keys) {
    if (samplesPerPixel < resolution) {
      config = timeinfo.get(resolution);
      break;
    }
  }
  if (config === void 0) {
    config = { marker: 3e4, bigStep: 1e4, smallStep: 5e3 };
  }
  return config;
}
var SmartScale = () => {
  const { samplesPerPixel, duration } = useContext7(PlaylistInfoContext);
  let config = getScaleInfo(samplesPerPixel);
  return /* @__PURE__ */ jsx18(
    StyledTimeScale,
    {
      marker: config.marker,
      bigStep: config.bigStep,
      secondStep: config.smallStep,
      duration
    }
  );
};

// src/components/TimeFormatSelect.tsx
import styled18 from "styled-components";
import { jsx as jsx19 } from "react/jsx-runtime";
var SelectWrapper = styled18.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`;
var TIME_FORMAT_OPTIONS = [
  { value: "seconds", label: "seconds" },
  { value: "thousandths", label: "thousandths" },
  { value: "hh:mm:ss", label: "hh:mm:ss" },
  { value: "hh:mm:ss.u", label: "hh:mm:ss + tenths" },
  { value: "hh:mm:ss.uu", label: "hh:mm:ss + hundredths" },
  { value: "hh:mm:ss.uuu", label: "hh:mm:ss + milliseconds" }
];
var TimeFormatSelect = ({
  value,
  onChange,
  disabled = false,
  className
}) => {
  const handleChange = (e) => {
    onChange(e.target.value);
  };
  return /* @__PURE__ */ jsx19(SelectWrapper, { className, children: /* @__PURE__ */ jsx19(
    BaseSelect,
    {
      className: "time-format",
      value,
      onChange: handleChange,
      disabled,
      "aria-label": "Time format selection",
      children: TIME_FORMAT_OPTIONS.map((option) => /* @__PURE__ */ jsx19("option", { value: option.value, children: option.label }, option.value))
    }
  ) });
};

// src/components/Track.tsx
import styled19 from "styled-components";
import { jsx as jsx20, jsxs as jsxs9 } from "react/jsx-runtime";
var Container = styled19.div.attrs((props) => ({
  style: {
    height: `${props.$waveHeight * props.$numChannels + (props.$hasClipHeaders ? CLIP_HEADER_HEIGHT : 0)}px`
  }
}))`
  position: relative;
  display: flex;
  ${(props) => props.$width !== void 0 && `width: ${props.$width}px;`}
`;
var ChannelContainer = styled19.div.attrs((props) => ({
  style: {
    paddingLeft: `${props.$offset || 0}px`
  }
}))`
  position: relative;
  background: ${(props) => props.$backgroundColor || "transparent"};
  flex: 1;
`;
var ControlsWrapper = styled19.div.attrs((props) => ({
  style: {
    width: `${props.$controlWidth}px`
  }
}))`
  position: sticky;
  z-index: 999;
  left: 0;
  height: 100%;
  flex-shrink: 0;
  pointer-events: auto;
  background: ${(props) => props.theme.surfaceColor};
  transition: background 0.15s ease-in-out;

  /* Selected track: highlighted background */
  ${(props) => props.$isSelected && `
    background: ${props.theme.selectedTrackControlsBackground};
  `}
`;
var Track = ({
  numChannels,
  children,
  className,
  backgroundColor,
  offset = 0,
  width,
  hasClipHeaders = false,
  onClick,
  trackId,
  isSelected = false
}) => {
  const {
    waveHeight,
    controls: { show, width: controlWidth }
  } = usePlaylistInfo();
  const controls = useTrackControls();
  return /* @__PURE__ */ jsxs9(
    Container,
    {
      $numChannels: numChannels,
      className,
      $waveHeight: waveHeight,
      $controlWidth: show ? controlWidth : 0,
      $width: width,
      $hasClipHeaders: hasClipHeaders,
      $isSelected: isSelected,
      children: [
        /* @__PURE__ */ jsx20(
          ControlsWrapper,
          {
            $controlWidth: show ? controlWidth : 0,
            $isSelected: isSelected,
            children: controls
          }
        ),
        /* @__PURE__ */ jsx20(
          ChannelContainer,
          {
            $controlWidth: show ? controlWidth : 0,
            $backgroundColor: backgroundColor,
            $offset: offset,
            onClick,
            "data-track-id": trackId,
            children
          }
        )
      ]
    }
  );
};

// src/components/TrackControls/Button.tsx
import styled20 from "styled-components";
var Button = styled20.button.attrs({
  type: "button"
})`
  display: inline-block;
  font-family: ${(props) => props.theme.fontFamily};
  font-weight: 500;
  text-align: center;
  vertical-align: middle;
  user-select: none;
  padding: 0.25rem 0.4rem;
  font-size: ${(props) => props.theme.fontSizeSmall};
  line-height: 1;
  border-radius: ${(props) => props.theme.borderRadius};
  transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out,
    border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  cursor: pointer;

  ${(props) => {
  if (props.$variant === "danger") {
    return `
        color: #fff;
        background-color: #dc3545;
        border: 1px solid #dc3545;

        &:hover {
          background-color: #c82333;
          border-color: #bd2130;
        }

        &:focus {
          outline: none;
          box-shadow: 0 0 0 0.2rem rgba(225, 83, 97, 0.5);
        }
      `;
  } else if (props.$variant === "info") {
    return `
        color: #fff;
        background-color: #17a2b8;
        border: 1px solid #17a2b8;

        &:hover {
          background-color: #138496;
          border-color: #117a8b;
        }

        &:focus {
          outline: none;
          box-shadow: 0 0 0 0.2rem rgba(58, 176, 195, 0.5);
        }
      `;
  } else {
    return `
        color: ${props.theme.textColor};
        background-color: transparent;
        border: 1px solid ${props.theme.borderColor};

        &:hover {
          color: #fff;
          background-color: ${props.theme.textColor};
          border-color: ${props.theme.textColor};
        }

        &:focus {
          outline: none;
          box-shadow: 0 0 0 0.2rem ${props.theme.inputFocusBorder}33;
        }
      `;
  }
}}
`;

// src/components/TrackControls/ButtonGroup.tsx
import styled21 from "styled-components";
var ButtonGroup = styled21.div`
  margin-bottom: 0.3rem;

  button:not(:first-child) {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  button:not(:last-child) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
`;

// src/components/TrackControls/Controls.tsx
import styled22 from "styled-components";
var Controls = styled22.div`
  background: transparent;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  overflow: hidden;
  box-sizing: border-box;
  text-align: center;
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${(props) => props.theme.borderRadius};
`;

// src/components/TrackControls/Header.tsx
import styled23 from "styled-components";
var Header = styled23.header`
  overflow: hidden;
  height: 26px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.2rem;
  font-size: ${(props) => props.theme.fontSizeSmall};
  color: ${(props) => props.theme.textColor};
  background-color: transparent;
`;

// src/components/TrackControls/VolumeDownIcon.tsx
import styled24 from "styled-components";
import { faVolumeDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
var VolumeDownIcon = styled24(FontAwesomeIcon).attrs({
  icon: faVolumeDown
})``;

// src/components/TrackControls/VolumeUpIcon.tsx
import styled25 from "styled-components";
import { faVolumeUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon as FontAwesomeIcon2 } from "@fortawesome/react-fontawesome";
var VolumeUpIcon = styled25(FontAwesomeIcon2).attrs({
  icon: faVolumeUp
})``;

// src/components/TrackControls/TrashIcon.tsx
import styled26 from "styled-components";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faTrashAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon as FontAwesomeIcon3 } from "@fortawesome/react-fontawesome";
library.add(faTrashAlt);
var TrashIcon = styled26(FontAwesomeIcon3).attrs({
  icon: "trash-alt"
})``;

// src/components/TrackControls/Slider.tsx
import styled27 from "styled-components";
var Slider = styled27(BaseSlider)`
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

// src/components/TrackControls/SliderWrapper.tsx
import styled28 from "styled-components";
var SliderWrapper = styled28.label`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1rem;
  margin-bottom: 0.2rem;
  font-size: 14px;
`;

// src/components/TrackControlsWithDelete.tsx
import styled29 from "styled-components";
import { jsx as jsx21, jsxs as jsxs10 } from "react/jsx-runtime";
var HeaderContainer2 = styled29.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.5rem 0.25rem 0.5rem;
`;
var TrackNameSpan = styled29.span`
  flex: 1;
  font-weight: 600;
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0 0.25rem;
`;
var DeleteIconButton = styled29.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  border-radius: 3px;
  transition: all 0.2s ease-in-out;
  flex-shrink: 0;

  &:hover {
    background: #dc3545;
    color: white;
  }

  &:active {
    transform: scale(0.9);
  }
`;
var TrackControlsWithDelete = ({
  trackName,
  muted,
  soloed,
  volume,
  pan,
  onMuteChange,
  onSoloChange,
  onVolumeChange,
  onPanChange,
  onDelete
}) => {
  return /* @__PURE__ */ jsxs10(Controls, { children: [
    /* @__PURE__ */ jsxs10(HeaderContainer2, { children: [
      /* @__PURE__ */ jsx21(DeleteIconButton, { onClick: onDelete, title: "Delete track", children: /* @__PURE__ */ jsx21(TrashIcon, {}) }),
      /* @__PURE__ */ jsx21(TrackNameSpan, { children: trackName })
    ] }),
    /* @__PURE__ */ jsxs10(ButtonGroup, { children: [
      /* @__PURE__ */ jsx21(
        Button,
        {
          $variant: muted ? "danger" : "outline",
          onClick: () => onMuteChange(!muted),
          children: "Mute"
        }
      ),
      /* @__PURE__ */ jsx21(
        Button,
        {
          $variant: soloed ? "info" : "outline",
          onClick: () => onSoloChange(!soloed),
          children: "Solo"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs10(SliderWrapper, { children: [
      /* @__PURE__ */ jsx21(VolumeDownIcon, {}),
      /* @__PURE__ */ jsx21(
        Slider,
        {
          min: "0",
          max: "1",
          step: "0.01",
          value: volume,
          onChange: (e) => onVolumeChange(parseFloat(e.target.value))
        }
      ),
      /* @__PURE__ */ jsx21(VolumeUpIcon, {})
    ] }),
    /* @__PURE__ */ jsxs10(SliderWrapper, { children: [
      /* @__PURE__ */ jsx21("span", { children: "L" }),
      /* @__PURE__ */ jsx21(
        Slider,
        {
          min: "-1",
          max: "1",
          step: "0.01",
          value: pan,
          onChange: (e) => onPanChange(parseFloat(e.target.value))
        }
      ),
      /* @__PURE__ */ jsx21("span", { children: "R" })
    ] })
  ] });
};

// src/wfpl-theme.ts
var defaultTheme = {
  waveOutlineColor: "#005BBB",
  waveFillColor: "#FFD500",
  waveProgressColor: "#ff0000",
  selectedWaveOutlineColor: "#0099ff",
  // Brighter blue for selected track waveforms
  selectedWaveFillColor: "#FFD500",
  // Same as waveFillColor - keep consistent on selection
  selectedTrackControlsBackground: "#d9e9ff",
  // Light blue background for selected track controls
  timeColor: "#000",
  timescaleBackgroundColor: "#fff",
  playheadColor: "#f00",
  selectionColor: "rgba(255, 105, 180, 0.7)",
  // hot pink - high contrast on light backgrounds
  clipHeaderBackgroundColor: "rgba(0, 0, 0, 0.1)",
  clipHeaderBorderColor: "rgba(0, 0, 0, 0.2)",
  clipHeaderTextColor: "#333",
  selectedClipHeaderBackgroundColor: "#b3d9ff",
  // Brighter blue for selected track clip headers
  // UI component colors
  backgroundColor: "#ffffff",
  surfaceColor: "#f5f5f5",
  borderColor: "#ddd",
  textColor: "#333",
  textColorMuted: "#666",
  // Interactive element colors
  inputBackground: "#ffffff",
  inputBorder: "#ccc",
  inputText: "#333",
  inputPlaceholder: "#999",
  inputFocusBorder: "#0066cc",
  // Button colors
  buttonBackground: "#f0f0f0",
  buttonText: "#333",
  buttonBorder: "#ccc",
  buttonHoverBackground: "#e0e0e0",
  // Slider colors
  sliderTrackColor: "#ddd",
  sliderThumbColor: "#daa520",
  // goldenrod
  // Annotation colors
  annotationBoxBackground: "rgba(255, 255, 255, 0.85)",
  annotationBoxActiveBackground: "rgba(255, 255, 255, 0.95)",
  annotationBoxHoverBackground: "rgba(255, 255, 255, 0.98)",
  annotationBoxBorder: "#ff9800",
  annotationBoxActiveBorder: "#d67600",
  annotationLabelColor: "#2a2a2a",
  annotationResizeHandleColor: "rgba(0, 0, 0, 0.4)",
  annotationResizeHandleActiveColor: "rgba(0, 0, 0, 0.8)",
  annotationTextItemHoverBackground: "rgba(0, 0, 0, 0.03)",
  // Spacing and sizing
  borderRadius: "4px",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
  fontSize: "14px",
  fontSizeSmall: "12px"
};
var darkTheme = {
  waveOutlineColor: "#4A9EFF",
  // Lighter blue for dark backgrounds
  waveFillColor: "#FFD500",
  waveProgressColor: "#ff4444",
  // Slightly brighter red
  selectedWaveOutlineColor: "#66B3FF",
  // Even lighter blue for selected tracks
  selectedWaveFillColor: "#FFD500",
  // Keep same yellow
  selectedTrackControlsBackground: "#1a3a5c",
  // Dark blue for selected track controls
  timeColor: "#e0e0e0",
  // Light gray for text on dark background
  timescaleBackgroundColor: "#1e1e1e",
  // Dark background
  playheadColor: "#ff4444",
  selectionColor: "rgba(255, 105, 180, 0.7)",
  // hot pink - high contrast on dark backgrounds
  clipHeaderBackgroundColor: "rgba(255, 255, 255, 0.1)",
  // Light overlay for dark mode
  clipHeaderBorderColor: "rgba(255, 255, 255, 0.2)",
  clipHeaderTextColor: "#e0e0e0",
  // Light text
  selectedClipHeaderBackgroundColor: "#2a4a6c",
  // Darker blue for selected clip headers
  // UI component colors
  backgroundColor: "#1e1e1e",
  surfaceColor: "#2d2d2d",
  borderColor: "#444",
  textColor: "#e0e0e0",
  textColorMuted: "#999",
  // Interactive element colors
  inputBackground: "#2d2d2d",
  inputBorder: "#555",
  inputText: "#e0e0e0",
  inputPlaceholder: "#777",
  inputFocusBorder: "#4A9EFF",
  // Button colors
  buttonBackground: "#3d3d3d",
  buttonText: "#e0e0e0",
  buttonBorder: "#555",
  buttonHoverBackground: "#4d4d4d",
  // Slider colors
  sliderTrackColor: "#555",
  sliderThumbColor: "#f0c040",
  // brighter goldenrod for dark mode
  // Annotation colors (dark mode)
  annotationBoxBackground: "rgba(45, 45, 45, 0.9)",
  annotationBoxActiveBackground: "rgba(55, 55, 55, 0.95)",
  annotationBoxHoverBackground: "rgba(65, 65, 65, 0.98)",
  annotationBoxBorder: "#ffb74d",
  annotationBoxActiveBorder: "#ffa726",
  annotationLabelColor: "#e0e0e0",
  annotationResizeHandleColor: "rgba(255, 255, 255, 0.4)",
  annotationResizeHandleActiveColor: "rgba(255, 255, 255, 0.8)",
  annotationTextItemHoverBackground: "rgba(255, 255, 255, 0.05)",
  // Spacing and sizing
  borderRadius: "4px",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
  fontSize: "14px",
  fontSizeSmall: "12px"
};
export {
  AudioPosition,
  AutomaticScrollCheckbox,
  BaseButton,
  BaseCheckbox,
  BaseCheckboxLabel,
  BaseCheckboxWrapper,
  BaseControlButton,
  BaseInput,
  BaseLabel,
  BaseSelect,
  BaseSlider,
  Button,
  ButtonGroup,
  CLIP_BOUNDARY_WIDTH,
  CLIP_HEADER_HEIGHT,
  Channel,
  Clip,
  ClipBoundary,
  ClipHeader,
  ClipHeaderPresentational,
  Controls,
  DevicePixelRatioProvider,
  Header,
  InlineLabel,
  MasterVolumeControl,
  Playhead,
  Playlist,
  PlaylistInfoContext,
  PlayoutProvider,
  ScreenReaderOnly,
  Selection,
  SelectionTimeInputs,
  Slider,
  SliderWrapper,
  SmartChannel,
  SmartScale,
  StyledPlaylist,
  StyledTimeScale,
  TimeFormatSelect,
  TimeInput,
  TimeScale,
  Track,
  TrackControlsContext,
  TrackControlsWithDelete,
  TrashIcon,
  VolumeDownIcon,
  VolumeUpIcon,
  darkTheme,
  defaultTheme,
  formatTime,
  parseTime,
  pixelsToSamples,
  pixelsToSeconds,
  samplesToPixels,
  samplesToSeconds,
  secondsToPixels,
  secondsToSamples,
  useDevicePixelRatio,
  usePlaylistInfo,
  usePlayoutStatus,
  usePlayoutStatusUpdate,
  useTheme,
  useTrackControls
};
//# sourceMappingURL=index.mjs.map