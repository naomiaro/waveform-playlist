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
  BBCWaveformData: () => BBCWaveformData,
  Button: () => Button,
  ButtonGroup: () => ButtonGroup,
  Channel: () => Channel,
  Controls: () => Controls,
  DevicePixelRatioProvider: () => DevicePixelRatioProvider,
  Header: () => Header,
  Playlist: () => Playlist,
  PlaylistInfoContext: () => PlaylistInfoContext,
  SmartChannel: () => SmartChannel,
  SmartScale: () => SmartScale,
  SmartTrack: () => SmartTrack,
  StyledPlaylist: () => StyledPlaylist,
  StyledTimeScale: () => StyledTimeScale,
  TimeScale: () => TimeScale,
  Track: () => Track,
  TrackControlsContext: () => TrackControlsContext,
  VolumeDownIcon: () => VolumeDownIcon,
  VolumeSlider: () => VolumeSlider,
  VolumeSliderWrapper: () => VolumeSliderWrapper,
  VolumeUpIcon: () => VolumeUpIcon,
  useDevicePixelRatio: () => useDevicePixelRatio,
  usePlaylistInfo: () => usePlaylistInfo,
  useTheme: () => useTheme,
  useTrackControls: () => useTrackControls,
  useWaveformData: () => useWaveformData
});
module.exports = __toCommonJS(index_exports);

// src/components/BBCExtractPeaks.tsx
var import_react = require("react");
var import_react_async_hook = require("react-async-hook");
var import_waveform_data = __toESM(require("waveform-data"));
var import_jsx_runtime = require("react/jsx-runtime");
var fetchPeaks = async (dataUri, type) => {
  const parsePeaksMethod = type === "dat" ? "arrayBuffer" : "json";
  const peaksResponse = await fetch(dataUri);
  const decodedPeaks = await peaksResponse[parsePeaksMethod]();
  return import_waveform_data.default.create(decodedPeaks);
};
function useWaveformData(location, type) {
  const asyncPeaks = (0, import_react_async_hook.useAsync)(fetchPeaks, [location, type]);
  return {
    loading: asyncPeaks.loading,
    error: asyncPeaks.error,
    data: asyncPeaks.result
  };
}
var BBCWaveformData = ({ location, type, children }) => {
  const asyncPeaks = useWaveformData(location, type);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Fragment, { children: children(asyncPeaks) });
};

// src/components/Channel.tsx
var import_react2 = require("react");
var import_styled_components = __toESM(require("styled-components"));
var import_jsx_runtime2 = require("react/jsx-runtime");
var MAX_CANVAS_WIDTH = 1e3;
var Progress = import_styled_components.default.div`
  position: absolute;
  background: ${(props) => props.$waveProgressColor};
  width: ${(props) => props.$progress}px;
  height: ${(props) => props.$waveHeight}px;
`;
var Waveform = import_styled_components.default.canvas`
  float: left;
  position: relative;
  width: ${(props) => props.$cssWidth}px;
  height: ${(props) => props.$waveHeight}px;
`;
var Wrapper = import_styled_components.default.div`
  position: absolute;
  top: ${(props) => props.$waveHeight * props.$index}px;
  background: ${(props) => props.$waveFillColor};
  width: ${(props) => props.$cssWidth}px;
  height: ${(props) => props.$waveHeight}px;
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
  const canvases = [];
  const canvasRef = (0, import_react2.useCallback)(
    (canvas) => {
      if (canvas !== null) {
        const index2 = parseInt(canvas.dataset.index, 10);
        canvases[index2] = canvas;
      }
    },
    [canvases]
  );
  (0, import_react2.useEffect)(() => {
    let offset = 0;
    for (let i = 0; i < canvases.length; i++) {
      const canvas = canvases[i];
      const ctx = canvas.getContext("2d");
      const h2 = waveHeight / 2;
      const maxValue = 2 ** (bits - 1);
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.resetTransform();
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
    length,
    canvases
  ]);
  let totalWidth = length;
  let waveformCount = 0;
  const waveforms = [];
  while (totalWidth > 0) {
    const currentWidth = Math.min(totalWidth, MAX_CANVAS_WIDTH);
    const waveform = /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    Wrapper,
    {
      $index: index,
      $cssWidth: length,
      className,
      $waveHeight: waveHeight,
      $waveFillColor: waveFillColor,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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

// src/components/Playlist.tsx
var import_styled_components2 = __toESM(require("styled-components"));
var import_jsx_runtime3 = require("react/jsx-runtime");
var Wrapper2 = import_styled_components2.default.div`
  overflow: hidden;
  position: relative;
`;
var ScrollContainer = import_styled_components2.default.div`
  overflow: auto;
`;
var Playlist = ({ children }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Wrapper2, { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ScrollContainer, { children }) });
};
var StyledPlaylist = (0, import_styled_components2.withTheme)(Playlist);

// src/contexts/DevicePixelRatio.tsx
var import_react3 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
function getScale() {
  return window.devicePixelRatio;
}
var DevicePixelRatioContext = (0, import_react3.createContext)(getScale());
var DevicePixelRatioProvider = ({ children }) => {
  const [scale, setScale] = (0, import_react3.useState)(getScale());
  matchMedia(`(resolution: ${getScale()}dppx)`).addEventListener(
    "change",
    () => {
      setScale(getScale());
    },
    { once: true }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(DevicePixelRatioContext.Provider, { value: Math.ceil(scale), children });
};
var useDevicePixelRatio = () => (0, import_react3.useContext)(DevicePixelRatioContext);

// src/contexts/PlaylistInfo.tsx
var import_react4 = require("react");
var PlaylistInfoContext = (0, import_react4.createContext)({
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
var usePlaylistInfo = () => (0, import_react4.useContext)(PlaylistInfoContext);

// src/contexts/Theme.tsx
var import_react5 = require("react");
var import_styled_components3 = require("styled-components");
var useTheme = () => (0, import_react5.useContext)(import_styled_components3.ThemeContext);

// src/contexts/TrackControls.tsx
var import_react6 = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
var TrackControlsContext = (0, import_react6.createContext)(/* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react6.Fragment, {}));
var useTrackControls = () => (0, import_react6.useContext)(TrackControlsContext);

// src/components/SmartChannel.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var SmartChannel = (props) => {
  const theme = useTheme();
  const { waveHeight } = usePlaylistInfo();
  const devicePixelRatio = useDevicePixelRatio();
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    Channel,
    {
      ...props,
      ...theme,
      waveHeight,
      devicePixelRatio
    }
  );
};

// src/components/SmartScale.tsx
var import_react8 = require("react");

// src/components/TimeScale.tsx
var import_react7 = require("react");
var import_styled_components4 = __toESM(require("styled-components"));

// src/utils/conversions.ts
function secondsToPixels(seconds, samplesPerPixel, sampleRate) {
  return Math.ceil(seconds * sampleRate / samplesPerPixel);
}

// src/components/TimeScale.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1e3);
  const s = seconds % 60;
  const m = (seconds - s) / 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
var PlaylistTimeScaleScroll = import_styled_components4.default.div`
  position: relative;
  width: ${(props) => props.cssWidth}px;
  margin-left: ${(props) => props.controlWidth}px;
  height: ${(props) => props.timeScaleHeight * 2}px;
`;
var TimeTicks = import_styled_components4.default.canvas`
  position: absolute;
  width: ${(props) => props.cssWidth}px;
  height: ${(props) => props.timeScaleHeight}px;
  left: 0;
  right: 0;
  bottom: 0;
`;
var TimeStamp = import_styled_components4.default.div`
  left: ${(props) => props.left}px;
  position: absolute;
`;
var TimeScale = (props) => {
  const {
    theme: { timeColor },
    duration,
    marker,
    bigStep,
    secondStep
  } = props;
  const canvasInfo = /* @__PURE__ */ new Map();
  const timeMarkers = [];
  const canvasRef = (0, import_react7.useRef)(null);
  const {
    sampleRate,
    samplesPerPixel,
    timeScaleHeight,
    controls: { show: showControls, width: controlWidth }
  } = (0, import_react7.useContext)(PlaylistInfoContext);
  const devicePixelRatio = useDevicePixelRatio();
  (0, import_react7.useEffect)(() => {
    if (canvasRef.current !== null) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.resetTransform();
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
      const timestamp = formatTime(counter);
      timeMarkers.push(
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TimeStamp, { left: pix, children: timestamp }, timestamp)
      );
      canvasInfo.set(pix, timeScaleHeight);
    } else if (counter % bigStep === 0) {
      canvasInfo.set(pix, Math.floor(timeScaleHeight / 2));
    } else if (counter % secondStep === 0) {
      canvasInfo.set(pix, Math.floor(timeScaleHeight / 5));
    }
    counter += secondStep;
  }
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    PlaylistTimeScaleScroll,
    {
      cssWidth: widthX,
      controlWidth: showControls ? controlWidth : 0,
      timeScaleHeight,
      children: [
        timeMarkers,
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          TimeTicks,
          {
            cssWidth: widthX,
            timeScaleHeight,
            width: widthX * devicePixelRatio,
            height: timeScaleHeight * devicePixelRatio,
            ref: canvasRef
          }
        )
      ]
    }
  );
};
var StyledTimeScale = (0, import_styled_components4.withTheme)(TimeScale);

// src/components/SmartScale.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
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
  const { samplesPerPixel, duration } = (0, import_react8.useContext)(PlaylistInfoContext);
  let config = getScaleInfo(samplesPerPixel);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    StyledTimeScale,
    {
      marker: config.marker,
      bigStep: config.bigStep,
      secondStep: config.smallStep,
      duration
    }
  );
};

// src/components/SmartTrack.tsx
var import_react9 = require("react");

// src/components/Track.tsx
var import_styled_components5 = __toESM(require("styled-components"));
var import_jsx_runtime9 = require("react/jsx-runtime");
var Container = import_styled_components5.default.div`
  height: ${(props) => props.waveHeight * props.numChannels}px;
  margin-left: ${(props) => props.controlWidth}px;
`;
var ChannelContainer = import_styled_components5.default.div`
  position: relative;
`;
var ControlsWrapper = import_styled_components5.default.div`
  width: ${(props) => props.controlWidth}px;
  position: absolute;
  z-index: 1;
  left: 0;
  height: 100%;
`;
var Track = ({
  numChannels,
  children,
  className
}) => {
  const {
    waveHeight,
    controls: { show, width }
  } = usePlaylistInfo();
  const controls = useTrackControls();
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
    Container,
    {
      numChannels,
      className,
      waveHeight,
      controlWidth: show ? width : 0,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ControlsWrapper, { controlWidth: show ? width : 0, children: controls }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ChannelContainer, { children })
      ]
    }
  );
};

// src/components/SmartTrack.tsx
var import_jsx_runtime10 = require("react/jsx-runtime");
function parseData(waveform, channel) {
  const peakLength = waveform.length;
  let data;
  if (waveform.bits === 8) {
    data = new Int8Array(peakLength * 2);
  } else {
    data = new Int16Array(peakLength * 2);
  }
  for (let i = 0; i < peakLength; i++) {
    data[i * 2] = waveform.channel(channel).min_sample(i);
    data[i * 2 + 1] = waveform.channel(channel).max_sample(i);
  }
  return data;
}
var WaveformDataTrack = ({
  waveformData
}) => {
  const { samplesPerPixel } = usePlaylistInfo();
  const waveform = waveformData.resample({ scale: samplesPerPixel });
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Track, { numChannels: waveform.channels, children: Array(waveform.channels).fill(0).map((_, i) => {
    return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      SmartChannel,
      {
        data: parseData(waveform, i),
        bits: waveform.bits,
        length: waveform.length,
        index: i
      },
      i
    );
  }) });
};
var SmartTrack = ({
  dataUri,
  type
}) => {
  const { data: waveformData } = useWaveformData(dataUri, type);
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_react9.Fragment, { children: [
    !waveformData && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Track, { numChannels: 0 }),
    waveformData && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(WaveformDataTrack, { waveformData })
  ] });
};

// src/components/TrackControls/Button.tsx
var import_styled_components6 = __toESM(require("styled-components"));
var Button = import_styled_components6.default.button.attrs({
  type: "button"
})`
  border: 1px solid black;
  padding: 5px;
`;

// src/components/TrackControls/ButtonGroup.tsx
var import_styled_components7 = __toESM(require("styled-components"));
var ButtonGroup = import_styled_components7.default.div`
  button:first-child {
    border-top-left-radius: 5px;
    border-bottom-left-radius: 5px;
  }

  button:last-child {
    border-top-right-radius: 5px;
    border-bottom-right-radius: 5px;
  }
`;

// src/components/TrackControls/Controls.tsx
var import_styled_components8 = __toESM(require("styled-components"));
var Controls = import_styled_components8.default.div`
  background: white;
  text-align: center;
  height: 100%;
  width: 100%;
`;

// src/components/TrackControls/Header.tsx
var import_styled_components9 = __toESM(require("styled-components"));
var Header = import_styled_components9.default.header`
  overflow: hidden;
  color: white;
  background-color: blueviolet;
  margin-bottom: 1em;
  height: 20px;
`;

// src/components/TrackControls/VolumeDownIcon.tsx
var import_styled_components10 = __toESM(require("styled-components"));
var import_fontawesome_svg_core = require("@fortawesome/fontawesome-svg-core");
var import_free_solid_svg_icons = require("@fortawesome/free-solid-svg-icons");
var import_react_fontawesome = require("@fortawesome/react-fontawesome");
import_fontawesome_svg_core.library.add(import_free_solid_svg_icons.faVolumeDown);
var VolumeDownIcon = (0, import_styled_components10.default)(import_react_fontawesome.FontAwesomeIcon).attrs({
  icon: "volume-down"
})``;

// src/components/TrackControls/VolumeUpIcon.tsx
var import_styled_components11 = __toESM(require("styled-components"));
var import_fontawesome_svg_core2 = require("@fortawesome/fontawesome-svg-core");
var import_free_solid_svg_icons2 = require("@fortawesome/free-solid-svg-icons");
var import_react_fontawesome2 = require("@fortawesome/react-fontawesome");
import_fontawesome_svg_core2.library.add(import_free_solid_svg_icons2.faVolumeUp);
var VolumeUpIcon = (0, import_styled_components11.default)(import_react_fontawesome2.FontAwesomeIcon).attrs({
  icon: "volume-up"
})``;

// src/components/TrackControls/VolumeSlider.tsx
var import_styled_components12 = __toESM(require("styled-components"));
var VolumeSlider = import_styled_components12.default.input.attrs({
  type: "range"
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

// src/components/TrackControls/VolumeSliderWrapper.tsx
var import_styled_components13 = __toESM(require("styled-components"));
var VolumeSliderWrapper = import_styled_components13.default.label`
  margin: 1em auto;
  width: 100%;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
`;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BBCWaveformData,
  Button,
  ButtonGroup,
  Channel,
  Controls,
  DevicePixelRatioProvider,
  Header,
  Playlist,
  PlaylistInfoContext,
  SmartChannel,
  SmartScale,
  SmartTrack,
  StyledPlaylist,
  StyledTimeScale,
  TimeScale,
  Track,
  TrackControlsContext,
  VolumeDownIcon,
  VolumeSlider,
  VolumeSliderWrapper,
  VolumeUpIcon,
  useDevicePixelRatio,
  usePlaylistInfo,
  useTheme,
  useTrackControls,
  useWaveformData
});
//# sourceMappingURL=index.js.map