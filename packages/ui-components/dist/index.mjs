// src/components/BBCExtractPeaks.tsx
import { Fragment } from "react";
import { useAsync } from "react-async-hook";
import WaveformData from "waveform-data";
import { jsx } from "react/jsx-runtime";
var fetchPeaks = async (dataUri, type) => {
  const parsePeaksMethod = type === "dat" ? "arrayBuffer" : "json";
  const peaksResponse = await fetch(dataUri);
  const decodedPeaks = await peaksResponse[parsePeaksMethod]();
  return WaveformData.create(decodedPeaks);
};
function useWaveformData(location, type) {
  const asyncPeaks = useAsync(fetchPeaks, [location, type]);
  return {
    loading: asyncPeaks.loading,
    error: asyncPeaks.error,
    data: asyncPeaks.result
  };
}
var BBCWaveformData = ({ location, type, children }) => {
  const asyncPeaks = useWaveformData(location, type);
  return /* @__PURE__ */ jsx(Fragment, { children: children(asyncPeaks) });
};

// src/components/Channel.tsx
import { useEffect, useCallback } from "react";
import styled from "styled-components";
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
var MAX_CANVAS_WIDTH = 1e3;
var Progress = styled.div`
  position: absolute;
  background: ${(props) => props.$waveProgressColor};
  width: ${(props) => props.$progress}px;
  height: ${(props) => props.$waveHeight}px;
`;
var Waveform = styled.canvas`
  float: left;
  position: relative;
  width: ${(props) => props.$cssWidth}px;
  height: ${(props) => props.$waveHeight}px;
`;
var Wrapper = styled.div`
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
  const canvasRef = useCallback(
    (canvas) => {
      if (canvas !== null) {
        const index2 = parseInt(canvas.dataset.index, 10);
        canvases[index2] = canvas;
      }
    },
    [canvases]
  );
  useEffect(() => {
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
    const waveform = /* @__PURE__ */ jsx2(
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
  return /* @__PURE__ */ jsxs(
    Wrapper,
    {
      $index: index,
      $cssWidth: length,
      className,
      $waveHeight: waveHeight,
      $waveFillColor: waveFillColor,
      children: [
        /* @__PURE__ */ jsx2(
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
import styled2, { withTheme } from "styled-components";
import { jsx as jsx3 } from "react/jsx-runtime";
var Wrapper2 = styled2.div`
  overflow: hidden;
  position: relative;
`;
var ScrollContainer = styled2.div`
  overflow: auto;
`;
var Playlist = ({ children }) => {
  return /* @__PURE__ */ jsx3(Wrapper2, { children: /* @__PURE__ */ jsx3(ScrollContainer, { children }) });
};
var StyledPlaylist = withTheme(Playlist);

// src/contexts/DevicePixelRatio.tsx
import { useState, createContext, useContext } from "react";
import { jsx as jsx4 } from "react/jsx-runtime";
function getScale() {
  return window.devicePixelRatio;
}
var DevicePixelRatioContext = createContext(getScale());
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
import { createContext as createContext3, useContext as useContext4, Fragment as Fragment2 } from "react";
import { jsx as jsx5 } from "react/jsx-runtime";
var TrackControlsContext = createContext3(/* @__PURE__ */ jsx5(Fragment2, {}));
var useTrackControls = () => useContext4(TrackControlsContext);

// src/components/SmartChannel.tsx
import { jsx as jsx6 } from "react/jsx-runtime";
var SmartChannel = (props) => {
  const theme = useTheme();
  const { waveHeight } = usePlaylistInfo();
  const devicePixelRatio = useDevicePixelRatio();
  return /* @__PURE__ */ jsx6(
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
import { useContext as useContext6 } from "react";

// src/components/TimeScale.tsx
import { useRef, useEffect as useEffect2, useContext as useContext5 } from "react";
import styled3, { withTheme as withTheme2 } from "styled-components";

// src/utils/conversions.ts
function secondsToPixels(seconds, samplesPerPixel, sampleRate) {
  return Math.ceil(seconds * sampleRate / samplesPerPixel);
}

// src/components/TimeScale.tsx
import { jsx as jsx7, jsxs as jsxs2 } from "react/jsx-runtime";
function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1e3);
  const s = seconds % 60;
  const m = (seconds - s) / 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
var PlaylistTimeScaleScroll = styled3.div`
  position: relative;
  width: ${(props) => props.cssWidth}px;
  margin-left: ${(props) => props.controlWidth}px;
  height: ${(props) => props.timeScaleHeight * 2}px;
`;
var TimeTicks = styled3.canvas`
  position: absolute;
  width: ${(props) => props.cssWidth}px;
  height: ${(props) => props.timeScaleHeight}px;
  left: 0;
  right: 0;
  bottom: 0;
`;
var TimeStamp = styled3.div`
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
  const canvasRef = useRef(null);
  const {
    sampleRate,
    samplesPerPixel,
    timeScaleHeight,
    controls: { show: showControls, width: controlWidth }
  } = useContext5(PlaylistInfoContext);
  const devicePixelRatio = useDevicePixelRatio();
  useEffect2(() => {
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
        /* @__PURE__ */ jsx7(TimeStamp, { left: pix, children: timestamp }, timestamp)
      );
      canvasInfo.set(pix, timeScaleHeight);
    } else if (counter % bigStep === 0) {
      canvasInfo.set(pix, Math.floor(timeScaleHeight / 2));
    } else if (counter % secondStep === 0) {
      canvasInfo.set(pix, Math.floor(timeScaleHeight / 5));
    }
    counter += secondStep;
  }
  return /* @__PURE__ */ jsxs2(
    PlaylistTimeScaleScroll,
    {
      cssWidth: widthX,
      controlWidth: showControls ? controlWidth : 0,
      timeScaleHeight,
      children: [
        timeMarkers,
        /* @__PURE__ */ jsx7(
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
var StyledTimeScale = withTheme2(TimeScale);

// src/components/SmartScale.tsx
import { jsx as jsx8 } from "react/jsx-runtime";
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
  const { samplesPerPixel, duration } = useContext6(PlaylistInfoContext);
  let config = getScaleInfo(samplesPerPixel);
  return /* @__PURE__ */ jsx8(
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
import { Fragment as Fragment3 } from "react";

// src/components/Track.tsx
import styled4 from "styled-components";
import { jsx as jsx9, jsxs as jsxs3 } from "react/jsx-runtime";
var Container = styled4.div`
  height: ${(props) => props.waveHeight * props.numChannels}px;
  margin-left: ${(props) => props.controlWidth}px;
`;
var ChannelContainer = styled4.div`
  position: relative;
`;
var ControlsWrapper = styled4.div`
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
  return /* @__PURE__ */ jsxs3(
    Container,
    {
      numChannels,
      className,
      waveHeight,
      controlWidth: show ? width : 0,
      children: [
        /* @__PURE__ */ jsx9(ControlsWrapper, { controlWidth: show ? width : 0, children: controls }),
        /* @__PURE__ */ jsx9(ChannelContainer, { children })
      ]
    }
  );
};

// src/components/SmartTrack.tsx
import { jsx as jsx10, jsxs as jsxs4 } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsx10(Track, { numChannels: waveform.channels, children: Array(waveform.channels).fill(0).map((_, i) => {
    return /* @__PURE__ */ jsx10(
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
  return /* @__PURE__ */ jsxs4(Fragment3, { children: [
    !waveformData && /* @__PURE__ */ jsx10(Track, { numChannels: 0 }),
    waveformData && /* @__PURE__ */ jsx10(WaveformDataTrack, { waveformData })
  ] });
};
export {
  BBCWaveformData,
  Channel,
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
  useDevicePixelRatio,
  usePlaylistInfo,
  useTheme,
  useTrackControls,
  useWaveformData
};
//# sourceMappingURL=index.mjs.map