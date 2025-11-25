"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.tsx
var index_exports = {};
__export(index_exports, {
  AudioPosition: () => AudioPosition,
  AutomaticScrollCheckbox: () => AutomaticScrollCheckbox,
  BaseButton: () => BaseButton,
  BaseCheckbox: () => BaseCheckbox,
  BaseCheckboxLabel: () => BaseCheckboxLabel,
  BaseCheckboxWrapper: () => BaseCheckboxWrapper,
  BaseControlButton: () => BaseControlButton,
  BaseInput: () => BaseInput,
  BaseLabel: () => BaseLabel,
  BaseSelect: () => BaseSelect,
  BaseSlider: () => BaseSlider,
  Button: () => Button,
  ButtonGroup: () => ButtonGroup,
  CLIP_BOUNDARY_WIDTH: () => CLIP_BOUNDARY_WIDTH,
  CLIP_HEADER_HEIGHT: () => CLIP_HEADER_HEIGHT,
  Channel: () => Channel,
  Clip: () => Clip,
  ClipBoundary: () => ClipBoundary,
  ClipHeader: () => ClipHeader,
  ClipHeaderPresentational: () => ClipHeaderPresentational,
  Controls: () => Controls,
  DevicePixelRatioProvider: () => DevicePixelRatioProvider,
  Header: () => Header,
  InlineLabel: () => InlineLabel,
  MasterVolumeControl: () => MasterVolumeControl,
  Playhead: () => Playhead,
  Playlist: () => Playlist,
  PlaylistInfoContext: () => PlaylistInfoContext,
  PlayoutProvider: () => PlayoutProvider,
  ScreenReaderOnly: () => ScreenReaderOnly,
  Selection: () => Selection,
  SelectionTimeInputs: () => SelectionTimeInputs,
  Slider: () => Slider,
  SliderWrapper: () => SliderWrapper,
  SmartChannel: () => SmartChannel,
  SmartScale: () => SmartScale,
  StyledPlaylist: () => StyledPlaylist,
  StyledTimeScale: () => StyledTimeScale,
  TimeFormatSelect: () => TimeFormatSelect,
  TimeInput: () => TimeInput,
  TimeScale: () => TimeScale,
  Track: () => Track,
  TrackControlsContext: () => TrackControlsContext,
  TrackControlsWithDelete: () => TrackControlsWithDelete,
  TrashIcon: () => TrashIcon,
  VolumeDownIcon: () => VolumeDownIcon,
  VolumeUpIcon: () => VolumeUpIcon,
  darkTheme: () => darkTheme,
  defaultTheme: () => defaultTheme,
  formatTime: () => formatTime,
  parseTime: () => parseTime,
  pixelsToSamples: () => pixelsToSamples,
  pixelsToSeconds: () => pixelsToSeconds,
  samplesToPixels: () => samplesToPixels,
  samplesToSeconds: () => samplesToSeconds,
  secondsToPixels: () => secondsToPixels,
  secondsToSamples: () => secondsToSamples,
  useDevicePixelRatio: () => useDevicePixelRatio,
  usePlaylistInfo: () => usePlaylistInfo,
  usePlayoutStatus: () => usePlayoutStatus,
  usePlayoutStatusUpdate: () => usePlayoutStatusUpdate,
  useTheme: () => useTheme,
  useTrackControls: () => useTrackControls
});
module.exports = __toCommonJS(index_exports);

// src/components/AudioPosition.tsx
var import_styled_components = __toESM(require("styled-components"));
var import_jsx_runtime = require("react/jsx-runtime");
var PositionDisplay = import_styled_components.default.span`
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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PositionDisplay, { className, "aria-label": "Audio position", children: formattedTime });
};

// src/styled/BaseButton.tsx
var import_styled_components2 = __toESM(require("styled-components"));
var BaseButton = import_styled_components2.default.button`
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
var BaseButtonSmall = (0, import_styled_components2.default)(BaseButton)`
  padding: 0.25rem 0.5rem;
  font-size: ${(props) => props.theme.fontSizeSmall};
`;
var IconButton = (0, import_styled_components2.default)(BaseButton)`
  padding: 0.5rem;
  min-width: 2.25rem;
  min-height: 2.25rem;
`;
var IconButtonSmall = (0, import_styled_components2.default)(BaseButton)`
  padding: 0.25rem;
  min-width: 1.75rem;
  min-height: 1.75rem;
  font-size: ${(props) => props.theme.fontSizeSmall};
`;

// src/styled/BaseCheckbox.tsx
var import_styled_components3 = __toESM(require("styled-components"));
var BaseCheckboxWrapper = import_styled_components3.default.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`;
var BaseCheckbox = import_styled_components3.default.input`
  cursor: pointer;
  accent-color: ${(props) => props.theme.inputFocusBorder};

  &:disabled {
    cursor: not-allowed;
  }
`;
var BaseCheckboxLabel = import_styled_components3.default.label`
  margin: 0;
  cursor: pointer;
  user-select: none;
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.theme.fontSize};
  color: ${(props) => props.theme.textColor};
`;

// src/styled/BaseControlButton.tsx
var import_styled_components4 = __toESM(require("styled-components"));
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
var BaseControlButton = import_styled_components4.default.button`
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
var import_styled_components5 = __toESM(require("styled-components"));
var BaseInput = import_styled_components5.default.input`
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
var BaseInputSmall = (0, import_styled_components5.default)(BaseInput)`
  padding: 0.25rem 0.5rem;
  font-size: ${(props) => props.theme.fontSizeSmall};
`;

// src/styled/BaseLabel.tsx
var import_styled_components6 = __toESM(require("styled-components"));
var BaseLabel = import_styled_components6.default.label`
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.theme.fontSizeSmall};
  font-weight: 500;
  color: ${(props) => props.theme.textColorMuted};
  margin-bottom: 0.25rem;
  display: block;
`;
var InlineLabel = import_styled_components6.default.label`
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.theme.fontSize};
  color: ${(props) => props.theme.textColor};
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
`;
var ScreenReaderOnly = import_styled_components6.default.span`
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
var import_styled_components7 = __toESM(require("styled-components"));
var BaseSelect = import_styled_components7.default.select`
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
var BaseSelectSmall = (0, import_styled_components7.default)(BaseSelect)`
  padding: 0.25rem 1.75rem 0.25rem 0.5rem;
  font-size: ${(props) => props.theme.fontSizeSmall};
`;

// src/styled/BaseSlider.tsx
var import_styled_components8 = __toESM(require("styled-components"));
var BaseSlider = import_styled_components8.default.input.attrs({ type: "range" })`
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
var import_jsx_runtime2 = require("react/jsx-runtime");
var AutomaticScrollCheckbox = ({
  checked,
  onChange,
  disabled = false,
  className
}) => {
  const handleChange = (e) => {
    onChange(e.target.checked);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(BaseCheckboxWrapper, { className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(BaseCheckboxLabel, { htmlFor: "automatic-scroll", children: "Automatic Scroll" })
  ] });
};

// src/components/Channel.tsx
var import_react = require("react");
var import_styled_components9 = __toESM(require("styled-components"));
var import_jsx_runtime3 = require("react/jsx-runtime");
var MAX_CANVAS_WIDTH = 1e3;
var Progress = import_styled_components9.default.div.attrs((props) => ({
  style: {
    width: `${props.$progress}px`,
    height: `${props.$waveHeight}px`
  }
}))`
  position: absolute;
  background: ${(props) => props.$waveProgressColor};
`;
var Waveform = import_styled_components9.default.canvas.attrs((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    height: `${props.$waveHeight}px`
  }
}))`
  float: left;
  position: relative;
`;
var Wrapper = import_styled_components9.default.div.attrs((props) => ({
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
  const canvasesRef = (0, import_react.useRef)([]);
  const canvasRef = (0, import_react.useCallback)(
    (canvas) => {
      if (canvas !== null) {
        const index2 = parseInt(canvas.dataset.index, 10);
        canvasesRef.current[index2] = canvas;
      }
    },
    []
  );
  (0, import_react.useLayoutEffect)(() => {
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
    const waveform = /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    Wrapper,
    {
      $index: index,
      $cssWidth: length,
      className,
      $waveHeight: waveHeight,
      $waveFillColor: waveFillColor,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
var import_styled_components12 = __toESM(require("styled-components"));
var import_core = require("@dnd-kit/core");
var import_utilities = require("@dnd-kit/utilities");

// src/components/ClipHeader.tsx
var import_styled_components10 = __toESM(require("styled-components"));
var import_jsx_runtime4 = require("react/jsx-runtime");
var CLIP_HEADER_HEIGHT = 22;
var HeaderContainer = import_styled_components10.default.div`
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
var TrackName = import_styled_components10.default.span`
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
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    HeaderContainer,
    {
      $isDragging: false,
      $interactive: false,
      $isSelected: isSelected,
      children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(TrackName, { children: trackName })
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
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      ClipHeaderPresentational,
      {
        trackName,
        isSelected
      }
    );
  }
  const { attributes, listeners, setActivatorNodeRef } = dragHandleProps;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    HeaderContainer,
    {
      ref: setActivatorNodeRef,
      "data-clip-id": clipId,
      $interactive: true,
      $isSelected: isSelected,
      ...listeners,
      ...attributes,
      children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(TrackName, { children: trackName })
    }
  );
};

// src/components/ClipBoundary.tsx
var import_react2 = __toESM(require("react"));
var import_styled_components11 = __toESM(require("styled-components"));
var import_jsx_runtime5 = require("react/jsx-runtime");
var CLIP_BOUNDARY_WIDTH = 8;
var BoundaryContainer = import_styled_components11.default.div`
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
  const [isHovered, setIsHovered] = import_react2.default.useState(false);
  if (!dragHandleProps) {
    return null;
  }
  const { attributes, listeners, setActivatorNodeRef, isDragging } = dragHandleProps;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
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
var import_jsx_runtime6 = require("react/jsx-runtime");
var ClipContainer = import_styled_components12.default.div.attrs((props) => ({
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
var ChannelsWrapper = import_styled_components12.default.div`
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
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = (0, import_core.useDraggable)({
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
  } = (0, import_core.useDraggable)({
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
  } = (0, import_core.useDraggable)({
    id: rightBoundaryId,
    data: { clipId, trackIndex, clipIndex, boundary: "right" },
    disabled: !enableDrag
  });
  const style = transform ? {
    transform: import_utilities.CSS.Translate.toString(transform),
    zIndex: isDragging ? 100 : void 0
    // Below controls (z-index: 999) but above other clips
  } : void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
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
        showHeader && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
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
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(ChannelsWrapper, { $isOverlay: isOverlay, children: [
          children,
          showHeader && !disableHeaderDrag && !isOverlay && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
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
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
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
var import_styled_components13 = __toESM(require("styled-components"));
var import_jsx_runtime7 = require("react/jsx-runtime");
var VolumeContainer = import_styled_components13.default.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`;
var VolumeLabel = (0, import_styled_components13.default)(BaseLabel)`
  margin: 0;
  white-space: nowrap;
`;
var VolumeSlider = (0, import_styled_components13.default)(BaseSlider)`
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
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(VolumeContainer, { className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(VolumeLabel, { htmlFor: "master-gain", children: "Master Volume" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
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
var import_styled_components14 = __toESM(require("styled-components"));
var import_jsx_runtime8 = require("react/jsx-runtime");
var PlayheadLine = import_styled_components14.default.div.attrs((props) => ({
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
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PlayheadLine, { $position: position, $color: color });
};

// src/components/Playlist.tsx
var import_styled_components15 = __toESM(require("styled-components"));
var import_jsx_runtime9 = require("react/jsx-runtime");
var Wrapper2 = import_styled_components15.default.div`
  overflow-y: hidden;
  overflow-x: auto;
  position: relative;
`;
var ScrollContainer = import_styled_components15.default.div`
  position: relative;
  background: ${(props) => props.$backgroundColor || "transparent"};
  ${(props) => props.$width !== void 0 && `width: ${props.$width}px;`}
`;
var TimescaleWrapper = import_styled_components15.default.div`
  background: ${(props) => props.$backgroundColor || "white"};
  ${(props) => props.$width && `min-width: ${props.$width}px;`}
  width: 100%;
  overflow: visible;
`;
var TracksContainer = import_styled_components15.default.div`
  position: relative;
  background: ${(props) => props.$backgroundColor || "transparent"};
  ${(props) => props.$width !== void 0 && `min-width: ${props.$width}px;`}
  width: 100%;
`;
var ClickOverlay = import_styled_components15.default.div`
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
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Wrapper2, { "data-scroll-container": "true", ref: scrollContainerRef, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
    ScrollContainer,
    {
      $backgroundColor: backgroundColor,
      $width: scrollContainerWidth,
      children: [
        timescale && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(TimescaleWrapper, { $width: timescaleWidth, $backgroundColor: timescaleBackgroundColor, children: timescale }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(TracksContainer, { $width: tracksWidth, $backgroundColor: backgroundColor, children: [
          children,
          (onTracksClick || onTracksMouseDown) && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
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
var StyledPlaylist = (0, import_styled_components15.withTheme)(Playlist);

// src/components/Selection.tsx
var import_styled_components16 = __toESM(require("styled-components"));
var import_jsx_runtime10 = require("react/jsx-runtime");
var SelectionOverlay = import_styled_components16.default.div.attrs((props) => ({
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
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(SelectionOverlay, { $left: startPosition, $width: width, $color: color });
};

// src/components/SelectionTimeInputs.tsx
var import_react4 = require("react");

// src/components/TimeInput.tsx
var import_react3 = require("react");

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
var import_jsx_runtime11 = require("react/jsx-runtime");
var TimeInput = ({
  id,
  label,
  value,
  format,
  className,
  onChange,
  readOnly = false
}) => {
  const [displayValue, setDisplayValue] = (0, import_react3.useState)("");
  (0, import_react3.useEffect)(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_jsx_runtime11.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(ScreenReaderOnly, { as: "label", htmlFor: id, children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
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
var import_jsx_runtime12 = require("react/jsx-runtime");
var SelectionTimeInputs = ({
  selectionStart,
  selectionEnd,
  onSelectionChange,
  className
}) => {
  const [timeFormat, setTimeFormat] = (0, import_react4.useState)("hh:mm:ss.uuu");
  (0, import_react4.useEffect)(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
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
var import_react5 = require("react");
var import_jsx_runtime13 = require("react/jsx-runtime");
function getScale() {
  return window.devicePixelRatio;
}
var DevicePixelRatioContext = (0, import_react5.createContext)(getScale());
var DevicePixelRatioProvider = ({ children }) => {
  const [scale, setScale] = (0, import_react5.useState)(getScale());
  matchMedia(`(resolution: ${getScale()}dppx)`).addEventListener(
    "change",
    () => {
      setScale(getScale());
    },
    { once: true }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(DevicePixelRatioContext.Provider, { value: Math.ceil(scale), children });
};
var useDevicePixelRatio = () => (0, import_react5.useContext)(DevicePixelRatioContext);

// src/contexts/PlaylistInfo.tsx
var import_react6 = require("react");
var PlaylistInfoContext = (0, import_react6.createContext)({
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
var usePlaylistInfo = () => (0, import_react6.useContext)(PlaylistInfoContext);

// src/contexts/Theme.tsx
var import_react7 = require("react");
var import_styled_components17 = require("styled-components");
var useTheme = () => (0, import_react7.useContext)(import_styled_components17.ThemeContext);

// src/contexts/TrackControls.tsx
var import_react8 = require("react");
var import_jsx_runtime14 = require("react/jsx-runtime");
var TrackControlsContext = (0, import_react8.createContext)(/* @__PURE__ */ (0, import_jsx_runtime14.jsx)(import_react8.Fragment, {}));
var useTrackControls = () => (0, import_react8.useContext)(TrackControlsContext);

// src/contexts/Playout.tsx
var import_react9 = require("react");
var import_jsx_runtime15 = require("react/jsx-runtime");
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
var PlayoutStatusContext = (0, import_react9.createContext)(defaultPlayout);
var PlayoutStatusUpdateContext = (0, import_react9.createContext)({
  setIsPlaying: () => {
  },
  setProgress: () => {
  },
  setSelection: () => {
  }
});
var PlayoutProvider = ({ children }) => {
  const [isPlaying, setIsPlaying] = (0, import_react9.useState)(defaultIsPlaying);
  const [progress, setProgress] = (0, import_react9.useState)(defaultProgress);
  const [selectionStart, setSelectionStart] = (0, import_react9.useState)(defaultSelectionStart);
  const [selectionEnd, setSelectionEnd] = (0, import_react9.useState)(defaultSelectionEnd);
  const setSelection = (start, end) => {
    setSelectionStart(start);
    setSelectionEnd(end);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(PlayoutStatusUpdateContext.Provider, { value: { setIsPlaying, setProgress, setSelection }, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(PlayoutStatusContext.Provider, { value: { isPlaying, progress, selectionStart, selectionEnd }, children }) });
};
var usePlayoutStatus = () => (0, import_react9.useContext)(PlayoutStatusContext);
var usePlayoutStatusUpdate = () => (0, import_react9.useContext)(PlayoutStatusUpdateContext);

// src/components/SmartChannel.tsx
var import_jsx_runtime16 = require("react/jsx-runtime");
var SmartChannel = ({ isSelected, ...props }) => {
  const theme = useTheme();
  const { waveHeight } = usePlaylistInfo();
  const devicePixelRatio = useDevicePixelRatio();
  const waveOutlineColor = isSelected && theme ? theme.selectedWaveOutlineColor : theme?.waveOutlineColor;
  const waveFillColor = isSelected && theme ? theme.selectedWaveFillColor : theme?.waveFillColor;
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
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
var import_react11 = require("react");

// src/components/TimeScale.tsx
var import_react10 = __toESM(require("react"));
var import_styled_components18 = __toESM(require("styled-components"));

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
var import_jsx_runtime17 = require("react/jsx-runtime");
function formatTime2(milliseconds) {
  const seconds = Math.floor(milliseconds / 1e3);
  const s = seconds % 60;
  const m = (seconds - s) / 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
var PlaylistTimeScaleScroll = import_styled_components18.default.div.attrs((props) => ({
  style: {
    width: `${props.$cssWidth}px`,
    marginLeft: `${props.$controlWidth}px`,
    height: `${props.$timeScaleHeight}px`
  }
}))`
  position: relative;
  overflow: visible; /* Allow time labels to render above the container */
`;
var TimeTicks = import_styled_components18.default.canvas.attrs((props) => ({
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
var TimeStamp = import_styled_components18.default.div.attrs((props) => ({
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
  const canvasRef = (0, import_react10.useRef)(null);
  const {
    sampleRate,
    samplesPerPixel,
    timeScaleHeight,
    controls: { show: showControls, width: controlWidth }
  } = (0, import_react10.useContext)(PlaylistInfoContext);
  const devicePixelRatio = useDevicePixelRatio();
  (0, import_react10.useEffect)(() => {
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
      const timestampContent = renderTimestamp ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_react10.default.Fragment, { children: renderTimestamp(timeMs, pix) }, `timestamp-${counter}`) : /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(TimeStamp, { $left: pix, children: timestamp }, timestamp);
      timeMarkers.push(timestampContent);
      canvasInfo.set(pix, timeScaleHeight);
    } else if (counter % bigStep === 0) {
      canvasInfo.set(pix, Math.floor(timeScaleHeight / 2));
    } else if (counter % secondStep === 0) {
      canvasInfo.set(pix, Math.floor(timeScaleHeight / 5));
    }
    counter += secondStep;
  }
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
    PlaylistTimeScaleScroll,
    {
      $cssWidth: widthX,
      $controlWidth: showControls ? controlWidth : 0,
      $timeScaleHeight: timeScaleHeight,
      children: [
        timeMarkers,
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
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
var StyledTimeScale = (0, import_styled_components18.withTheme)(TimeScale);

// src/components/SmartScale.tsx
var import_jsx_runtime18 = require("react/jsx-runtime");
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
  const { samplesPerPixel, duration } = (0, import_react11.useContext)(PlaylistInfoContext);
  let config = getScaleInfo(samplesPerPixel);
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
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
var import_styled_components19 = __toESM(require("styled-components"));
var import_jsx_runtime19 = require("react/jsx-runtime");
var SelectWrapper = import_styled_components19.default.div`
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
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(SelectWrapper, { className, children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
    BaseSelect,
    {
      className: "time-format",
      value,
      onChange: handleChange,
      disabled,
      "aria-label": "Time format selection",
      children: TIME_FORMAT_OPTIONS.map((option) => /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("option", { value: option.value, children: option.label }, option.value))
    }
  ) });
};

// src/components/Track.tsx
var import_styled_components20 = __toESM(require("styled-components"));
var import_jsx_runtime20 = require("react/jsx-runtime");
var Container = import_styled_components20.default.div.attrs((props) => ({
  style: {
    height: `${props.$waveHeight * props.$numChannels + (props.$hasClipHeaders ? CLIP_HEADER_HEIGHT : 0)}px`
  }
}))`
  position: relative;
  display: flex;
  ${(props) => props.$width !== void 0 && `width: ${props.$width}px;`}
`;
var ChannelContainer = import_styled_components20.default.div.attrs((props) => ({
  style: {
    paddingLeft: `${props.$offset || 0}px`
  }
}))`
  position: relative;
  background: ${(props) => props.$backgroundColor || "transparent"};
  flex: 1;
`;
var ControlsWrapper = import_styled_components20.default.div.attrs((props) => ({
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
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
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
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
          ControlsWrapper,
          {
            $controlWidth: show ? controlWidth : 0,
            $isSelected: isSelected,
            children: controls
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
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
var import_styled_components21 = __toESM(require("styled-components"));
var Button = import_styled_components21.default.button.attrs({
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
var import_styled_components22 = __toESM(require("styled-components"));
var ButtonGroup = import_styled_components22.default.div`
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
var import_styled_components23 = __toESM(require("styled-components"));
var Controls = import_styled_components23.default.div`
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
var import_styled_components24 = __toESM(require("styled-components"));
var Header = import_styled_components24.default.header`
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
var import_styled_components25 = __toESM(require("styled-components"));
var import_free_solid_svg_icons = require("@fortawesome/free-solid-svg-icons");
var import_react_fontawesome = require("@fortawesome/react-fontawesome");
var VolumeDownIcon = (0, import_styled_components25.default)(import_react_fontawesome.FontAwesomeIcon).attrs({
  icon: import_free_solid_svg_icons.faVolumeDown
})``;

// src/components/TrackControls/VolumeUpIcon.tsx
var import_styled_components26 = __toESM(require("styled-components"));
var import_free_solid_svg_icons2 = require("@fortawesome/free-solid-svg-icons");
var import_react_fontawesome2 = require("@fortawesome/react-fontawesome");
var VolumeUpIcon = (0, import_styled_components26.default)(import_react_fontawesome2.FontAwesomeIcon).attrs({
  icon: import_free_solid_svg_icons2.faVolumeUp
})``;

// src/components/TrackControls/TrashIcon.tsx
var import_styled_components27 = __toESM(require("styled-components"));
var import_fontawesome_svg_core = require("@fortawesome/fontawesome-svg-core");
var import_free_solid_svg_icons3 = require("@fortawesome/free-solid-svg-icons");
var import_react_fontawesome3 = require("@fortawesome/react-fontawesome");
import_fontawesome_svg_core.library.add(import_free_solid_svg_icons3.faTrashAlt);
var TrashIcon = (0, import_styled_components27.default)(import_react_fontawesome3.FontAwesomeIcon).attrs({
  icon: "trash-alt"
})``;

// src/components/TrackControls/Slider.tsx
var import_styled_components28 = __toESM(require("styled-components"));
var Slider = (0, import_styled_components28.default)(BaseSlider)`
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
var import_styled_components29 = __toESM(require("styled-components"));
var SliderWrapper = import_styled_components29.default.label`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1rem;
  margin-bottom: 0.2rem;
  font-size: 14px;
`;

// src/components/TrackControlsWithDelete.tsx
var import_styled_components30 = __toESM(require("styled-components"));
var import_jsx_runtime21 = require("react/jsx-runtime");
var HeaderContainer2 = import_styled_components30.default.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.5rem 0.25rem 0.5rem;
`;
var TrackNameSpan = import_styled_components30.default.span`
  flex: 1;
  font-weight: 600;
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0 0.25rem;
`;
var DeleteIconButton = import_styled_components30.default.button`
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
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(Controls, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(HeaderContainer2, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(DeleteIconButton, { onClick: onDelete, title: "Delete track", children: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(TrashIcon, {}) }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(TrackNameSpan, { children: trackName })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(ButtonGroup, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
        Button,
        {
          $variant: muted ? "danger" : "outline",
          onClick: () => onMuteChange(!muted),
          children: "Mute"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
        Button,
        {
          $variant: soloed ? "info" : "outline",
          onClick: () => onSoloChange(!soloed),
          children: "Solo"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(SliderWrapper, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(VolumeDownIcon, {}),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
        Slider,
        {
          min: "0",
          max: "1",
          step: "0.01",
          value: volume,
          onChange: (e) => onVolumeChange(parseFloat(e.target.value))
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(VolumeUpIcon, {})
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(SliderWrapper, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { children: "L" }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
        Slider,
        {
          min: "-1",
          max: "1",
          step: "0.01",
          value: pan,
          onChange: (e) => onPanChange(parseFloat(e.target.value))
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { children: "R" })
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
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
});
//# sourceMappingURL=index.js.map