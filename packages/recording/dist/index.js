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

// src/index.ts
var src_exports = {};
__export(src_exports, {
  MicrophoneSelector: () => MicrophoneSelector,
  RecordButton: () => RecordButton,
  RecordingIndicator: () => RecordingIndicator2,
  VUMeter: () => VUMeter,
  concatenateAudioData: () => concatenateAudioData,
  createAudioBuffer: () => createAudioBuffer,
  generatePeaks: () => generatePeaks,
  useMicrophoneAccess: () => useMicrophoneAccess,
  useMicrophoneLevel: () => useMicrophoneLevel,
  useRecording: () => useRecording
});
module.exports = __toCommonJS(src_exports);

// src/hooks/useRecording.ts
var import_react = require("react");

// src/utils/audioBufferUtils.ts
function concatenateAudioData(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
function createAudioBuffer(audioContext, samples, sampleRate, channelCount = 1) {
  const buffer = audioContext.createBuffer(
    channelCount,
    samples.length,
    sampleRate
  );
  const typedSamples = new Float32Array(samples);
  buffer.copyToChannel(typedSamples, 0);
  return buffer;
}

// src/utils/peaksGenerator.ts
function generatePeaks(samples, samplesPerPixel, bits = 16) {
  const numPeaks = Math.ceil(samples.length / samplesPerPixel);
  const peakArray = bits === 8 ? new Int8Array(numPeaks * 2) : new Int16Array(numPeaks * 2);
  const maxValue = 2 ** (bits - 1);
  for (let i = 0; i < numPeaks; i++) {
    const start = i * samplesPerPixel;
    const end = Math.min(start + samplesPerPixel, samples.length);
    let min = 0;
    let max = 0;
    for (let j = start; j < end; j++) {
      const value = samples[j];
      if (value < min) min = value;
      if (value > max) max = value;
    }
    peakArray[i * 2] = Math.floor(min * maxValue);
    peakArray[i * 2 + 1] = Math.floor(max * maxValue);
  }
  return peakArray;
}
function appendPeaks(existingPeaks, newSamples, samplesPerPixel, totalSamplesProcessed, bits = 16) {
  const maxValue = 2 ** (bits - 1);
  const remainder = totalSamplesProcessed % samplesPerPixel;
  let offset = 0;
  if (remainder > 0 && existingPeaks.length > 0) {
    const samplesToComplete = samplesPerPixel - remainder;
    const endIndex = Math.min(samplesToComplete, newSamples.length);
    let min = existingPeaks[existingPeaks.length - 2] / maxValue;
    let max = existingPeaks[existingPeaks.length - 1] / maxValue;
    for (let i = 0; i < endIndex; i++) {
      const value = newSamples[i];
      if (value < min) min = value;
      if (value > max) max = value;
    }
    const updated = new (bits === 8 ? Int8Array : Int16Array)(existingPeaks.length);
    updated.set(existingPeaks);
    updated[existingPeaks.length - 2] = Math.floor(min * maxValue);
    updated[existingPeaks.length - 1] = Math.floor(max * maxValue);
    offset = endIndex;
    const newPeaks2 = generatePeaks(newSamples.slice(offset), samplesPerPixel, bits);
    const result2 = new (bits === 8 ? Int8Array : Int16Array)(updated.length + newPeaks2.length);
    result2.set(updated);
    result2.set(newPeaks2, updated.length);
    return result2;
  }
  const newPeaks = generatePeaks(newSamples.slice(offset), samplesPerPixel, bits);
  const result = new (bits === 8 ? Int8Array : Int16Array)(existingPeaks.length + newPeaks.length);
  result.set(existingPeaks);
  result.set(newPeaks, existingPeaks.length);
  return result;
}

// src/hooks/useRecording.ts
var import_playout = require("@waveform-playlist/playout");
var import_meta = {};
function useRecording(stream, options = {}) {
  const {
    channelCount = 1,
    samplesPerPixel = 1024
  } = options;
  const [isRecording, setIsRecording] = (0, import_react.useState)(false);
  const [isPaused, setIsPaused] = (0, import_react.useState)(false);
  const [duration, setDuration] = (0, import_react.useState)(0);
  const [peaks, setPeaks] = (0, import_react.useState)(new Int16Array(0));
  const [audioBuffer, setAudioBuffer] = (0, import_react.useState)(null);
  const [error, setError] = (0, import_react.useState)(null);
  const [level, setLevel] = (0, import_react.useState)(0);
  const [peakLevel, setPeakLevel] = (0, import_react.useState)(0);
  const bits = 16;
  const workletLoadedRef = (0, import_react.useRef)(false);
  const workletNodeRef = (0, import_react.useRef)(null);
  const mediaStreamSourceRef = (0, import_react.useRef)(null);
  const recordedChunksRef = (0, import_react.useRef)([]);
  const totalSamplesRef = (0, import_react.useRef)(0);
  const animationFrameRef = (0, import_react.useRef)(null);
  const startTimeRef = (0, import_react.useRef)(0);
  const isRecordingRef = (0, import_react.useRef)(false);
  const isPausedRef = (0, import_react.useRef)(false);
  const loadWorklet = (0, import_react.useCallback)(async (context) => {
    if (workletLoadedRef.current) {
      return;
    }
    try {
      const workletUrl = new URL(
        "./worklet/recording-processor.worklet.js",
        import_meta.url
      ).href;
      await context.audioWorklet.addModule(workletUrl);
      workletLoadedRef.current = true;
    } catch (err) {
      console.error("Failed to load AudioWorklet module:", err);
      throw new Error("Failed to load recording processor");
    }
  }, []);
  const startRecording = (0, import_react.useCallback)(async () => {
    if (!stream) {
      setError(new Error("No microphone stream available"));
      return;
    }
    try {
      setError(null);
      const context = (0, import_playout.getGlobalAudioContext)();
      await (0, import_playout.resumeGlobalAudioContext)();
      await loadWorklet(context);
      const source = (0, import_playout.getMediaStreamSource)(stream);
      mediaStreamSourceRef.current = source;
      const workletNode = new AudioWorkletNode(context, "recording-processor");
      workletNodeRef.current = workletNode;
      source.connect(workletNode);
      workletNode.port.onmessage = (event) => {
        const { samples } = event.data;
        recordedChunksRef.current.push(samples);
        totalSamplesRef.current += samples.length;
        setPeaks(
          (prevPeaks) => appendPeaks(
            prevPeaks,
            samples,
            samplesPerPixel,
            totalSamplesRef.current - samples.length,
            bits
          )
        );
      };
      workletNode.port.postMessage({
        command: "start",
        sampleRate: context.sampleRate,
        channelCount
      });
      recordedChunksRef.current = [];
      totalSamplesRef.current = 0;
      setPeaks(new Int16Array(0));
      setAudioBuffer(null);
      setLevel(0);
      setPeakLevel(0);
      isRecordingRef.current = true;
      isPausedRef.current = false;
      setIsRecording(true);
      setIsPaused(false);
      startTimeRef.current = performance.now();
      const updateDuration = () => {
        if (isRecordingRef.current && !isPausedRef.current) {
          const elapsed = (performance.now() - startTimeRef.current) / 1e3;
          setDuration(elapsed);
          animationFrameRef.current = requestAnimationFrame(updateDuration);
        }
      };
      updateDuration();
    } catch (err) {
      console.error("Failed to start recording:", err);
      setError(err instanceof Error ? err : new Error("Failed to start recording"));
    }
  }, [stream, channelCount, samplesPerPixel, loadWorklet, isRecording, isPaused]);
  const stopRecording = (0, import_react.useCallback)(async () => {
    if (!isRecording) {
      return null;
    }
    try {
      if (workletNodeRef.current) {
        workletNodeRef.current.port.postMessage({ command: "stop" });
        if (mediaStreamSourceRef.current) {
          try {
            mediaStreamSourceRef.current.disconnect(workletNodeRef.current);
          } catch (e) {
          }
        }
        workletNodeRef.current.disconnect();
      }
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      const allSamples = concatenateAudioData(recordedChunksRef.current);
      const context = (0, import_playout.getGlobalAudioContext)();
      const buffer = createAudioBuffer(
        context,
        allSamples,
        context.sampleRate,
        channelCount
      );
      setAudioBuffer(buffer);
      setDuration(buffer.duration);
      isRecordingRef.current = false;
      isPausedRef.current = false;
      setIsRecording(false);
      setIsPaused(false);
      setLevel(0);
      return buffer;
    } catch (err) {
      console.error("Failed to stop recording:", err);
      setError(err instanceof Error ? err : new Error("Failed to stop recording"));
      return null;
    }
  }, [isRecording, channelCount]);
  const pauseRecording = (0, import_react.useCallback)(() => {
    if (isRecording && !isPaused) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      isPausedRef.current = true;
      setIsPaused(true);
    }
  }, [isRecording, isPaused]);
  const resumeRecording = (0, import_react.useCallback)(() => {
    if (isRecording && isPaused) {
      isPausedRef.current = false;
      setIsPaused(false);
      startTimeRef.current = performance.now() - duration * 1e3;
      const updateDuration = () => {
        if (isRecordingRef.current && !isPausedRef.current) {
          const elapsed = (performance.now() - startTimeRef.current) / 1e3;
          setDuration(elapsed);
          animationFrameRef.current = requestAnimationFrame(updateDuration);
        }
      };
      updateDuration();
    }
  }, [isRecording, isPaused, duration]);
  (0, import_react.useEffect)(() => {
    return () => {
      if (workletNodeRef.current) {
        workletNodeRef.current.port.postMessage({ command: "stop" });
        if (mediaStreamSourceRef.current) {
          try {
            mediaStreamSourceRef.current.disconnect(workletNodeRef.current);
          } catch (e) {
          }
        }
        workletNodeRef.current.disconnect();
      }
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);
  return {
    isRecording,
    isPaused,
    duration,
    peaks,
    audioBuffer,
    level,
    peakLevel,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    error
  };
}

// src/hooks/useMicrophoneAccess.ts
var import_react2 = require("react");
function useMicrophoneAccess() {
  const [stream, setStream] = (0, import_react2.useState)(null);
  const [devices, setDevices] = (0, import_react2.useState)([]);
  const [hasPermission, setHasPermission] = (0, import_react2.useState)(false);
  const [isLoading, setIsLoading] = (0, import_react2.useState)(false);
  const [error, setError] = (0, import_react2.useState)(null);
  const enumerateDevices = (0, import_react2.useCallback)(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices.filter((device) => device.kind === "audioinput").map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
        groupId: device.groupId
      }));
      setDevices(audioInputs);
    } catch (err) {
      console.error("Failed to enumerate devices:", err);
      setError(err instanceof Error ? err : new Error("Failed to enumerate devices"));
    }
  }, []);
  const requestAccess = (0, import_react2.useCallback)(async (deviceId, audioConstraints) => {
    setIsLoading(true);
    setError(null);
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const audio = {
        // Recording-optimized defaults: prioritize raw audio quality and low latency
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        latency: 0,
        // Low latency mode (not in TS types yet, but supported in modern browsers)
        // User-provided constraints override defaults
        ...audioConstraints,
        // Device ID override (if specified)
        ...deviceId && { deviceId: { exact: deviceId } }
      };
      const constraints = {
        audio,
        video: false
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      setHasPermission(true);
      await enumerateDevices();
    } catch (err) {
      console.error("Failed to access microphone:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to access microphone")
      );
      setHasPermission(false);
    } finally {
      setIsLoading(false);
    }
  }, [stream, enumerateDevices]);
  const stopStream = (0, import_react2.useCallback)(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setHasPermission(false);
    }
  }, [stream]);
  (0, import_react2.useEffect)(() => {
    enumerateDevices();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);
  return {
    stream,
    devices,
    hasPermission,
    isLoading,
    requestAccess,
    stopStream,
    error
  };
}

// src/hooks/useMicrophoneLevel.ts
var import_react3 = require("react");
var import_playout2 = require("@waveform-playlist/playout");
function useMicrophoneLevel(stream, options = {}) {
  const {
    updateRate = 60,
    fftSize = 256,
    smoothingTimeConstant = 0.8
  } = options;
  const [level, setLevel] = (0, import_react3.useState)(0);
  const [peakLevel, setPeakLevel] = (0, import_react3.useState)(0);
  const analyserRef = (0, import_react3.useRef)(null);
  const sourceRef = (0, import_react3.useRef)(null);
  const animationFrameRef = (0, import_react3.useRef)(null);
  const dataArrayRef = (0, import_react3.useRef)(null);
  const resetPeak = () => setPeakLevel(0);
  (0, import_react3.useEffect)(() => {
    if (!stream) {
      setLevel(0);
      setPeakLevel(0);
      return;
    }
    let isMounted = true;
    const setupMonitoring = async () => {
      const context = (0, import_playout2.getGlobalAudioContext)();
      if (!isMounted) return;
      const analyser = context.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.smoothingTimeConstant = smoothingTimeConstant;
      analyserRef.current = analyser;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;
      const source = (0, import_playout2.getMediaStreamSource)(stream);
      source.connect(analyser);
      sourceRef.current = source;
      const updateInterval = 1e3 / updateRate;
      let lastUpdateTime = 0;
      const updateLevel = (timestamp) => {
        if (timestamp - lastUpdateTime >= updateInterval) {
          lastUpdateTime = timestamp;
          analyser.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            sum += normalized * normalized;
          }
          const rms = Math.sqrt(sum / bufferLength);
          setLevel(rms);
          setPeakLevel((prev) => Math.max(prev, rms));
        }
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };
    setupMonitoring();
    return () => {
      isMounted = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (analyserRef.current && sourceRef.current) {
        try {
          sourceRef.current.disconnect(analyserRef.current);
        } catch (e) {
        }
      }
      analyserRef.current = null;
      sourceRef.current = null;
      dataArrayRef.current = null;
    };
  }, [stream, fftSize, smoothingTimeConstant, updateRate]);
  return {
    level,
    peakLevel,
    resetPeak
  };
}

// src/components/RecordButton.tsx
var import_styled_components = __toESM(require("styled-components"));
var import_jsx_runtime = require("react/jsx-runtime");
var Button = import_styled_components.default.button`
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  background: ${(props) => props.$isRecording ? "#dc3545" : "#e74c3c"};
  color: white;

  &:hover:not(:disabled) {
    background: ${(props) => props.$isRecording ? "#c82333" : "#c0392b"};
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.3);
  }
`;
var RecordingIndicator = import_styled_components.default.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: white;
  margin-right: 0.5rem;
  animation: pulse 1.5s ease-in-out infinite;

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }
`;
var RecordButton = ({
  isRecording,
  onClick,
  disabled = false,
  className
}) => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    Button,
    {
      $isRecording: isRecording,
      onClick,
      disabled,
      className,
      "aria-label": isRecording ? "Stop recording" : "Start recording",
      children: [
        isRecording && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecordingIndicator, {}),
        isRecording ? "Stop Recording" : "Record"
      ]
    }
  );
};

// src/components/MicrophoneSelector.tsx
var import_styled_components2 = __toESM(require("styled-components"));
var import_ui_components = require("@waveform-playlist/ui-components");
var import_jsx_runtime2 = require("react/jsx-runtime");
var Select = (0, import_styled_components2.default)(import_ui_components.BaseSelect)`
  min-width: 200px;
`;
var Label = (0, import_styled_components2.default)(import_ui_components.BaseLabel)`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;
var MicrophoneSelector = ({
  devices,
  selectedDeviceId,
  onDeviceChange,
  disabled = false,
  className
}) => {
  const handleChange = (event) => {
    onDeviceChange(event.target.value);
  };
  const currentValue = selectedDeviceId || (devices.length > 0 ? devices[0].deviceId : "");
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Label, { className, children: [
    "Microphone",
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      Select,
      {
        value: currentValue,
        onChange: handleChange,
        disabled: disabled || devices.length === 0,
        children: devices.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "", children: "No microphones found" }) : devices.map((device) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: device.deviceId, children: device.label }, device.deviceId))
      }
    )
  ] });
};

// src/components/RecordingIndicator.tsx
var import_styled_components3 = __toESM(require("styled-components"));
var import_jsx_runtime3 = require("react/jsx-runtime");
var Container = import_styled_components3.default.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: ${(props) => props.$isRecording ? "#fff3cd" : "transparent"};
  border-radius: 0.25rem;
  transition: background 0.2s ease-in-out;
`;
var Dot = import_styled_components3.default.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${(props) => props.$isPaused ? "#ffc107" : "#dc3545"};
  opacity: ${(props) => props.$isRecording ? 1 : 0};
  transition: opacity 0.2s ease-in-out;

  ${(props) => props.$isRecording && !props.$isPaused && `
    animation: blink 1.5s ease-in-out infinite;

    @keyframes blink {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.3;
      }
    }
  `}
`;
var Duration = import_styled_components3.default.span`
  font-family: 'Courier New', Monaco, monospace;
  font-size: 1rem;
  font-weight: 600;
  color: #495057;
  min-width: 70px;
`;
var Status = import_styled_components3.default.span`
  font-size: 0.75rem;
  font-weight: 500;
  color: ${(props) => props.$isPaused ? "#ffc107" : "#dc3545"};
  text-transform: uppercase;
`;
var defaultFormatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};
var RecordingIndicator2 = ({
  isRecording,
  isPaused = false,
  duration,
  formatTime = defaultFormatTime,
  className
}) => {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Container, { $isRecording: isRecording, className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Dot, { $isRecording: isRecording, $isPaused: isPaused }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Duration, { children: formatTime(duration) }),
    isRecording && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Status, { $isPaused: isPaused, children: isPaused ? "Paused" : "Recording" })
  ] });
};

// src/components/VUMeter.tsx
var import_react4 = __toESM(require("react"));
var import_styled_components4 = __toESM(require("styled-components"));
var import_jsx_runtime4 = require("react/jsx-runtime");
var MeterContainer = import_styled_components4.default.div`
  position: relative;
  width: ${(props) => props.$width}px;
  height: ${(props) => props.$height}px;
  background: #2c3e50;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
`;
var MeterFill = import_styled_components4.default.div`
  position: absolute;
  left: 0;
  top: 0;
  height: ${(props) => props.$height}px;
  width: ${(props) => props.$level * 100}%;
  background: ${(props) => {
  if (props.$level < 0.6) return "linear-gradient(90deg, #27ae60, #2ecc71)";
  if (props.$level < 0.85) return "linear-gradient(90deg, #f39c12, #f1c40f)";
  return "linear-gradient(90deg, #c0392b, #e74c3c)";
}};
  transition: width 0.05s ease-out, background 0.1s ease-out;
  box-shadow: ${(props) => props.$level > 0.01 ? "0 0 8px rgba(255, 255, 255, 0.3)" : "none"};
`;
var PeakIndicator = import_styled_components4.default.div`
  position: absolute;
  left: ${(props) => props.$peakLevel * 100}%;
  top: 0;
  width: 2px;
  height: ${(props) => props.$height}px;
  background: #ecf0f1;
  box-shadow: 0 0 4px rgba(236, 240, 241, 0.8);
  transition: left 0.1s ease-out;
`;
var ScaleMarkers = import_styled_components4.default.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: ${(props) => props.$height}px;
  pointer-events: none;
`;
var ScaleMark = import_styled_components4.default.div`
  position: absolute;
  left: ${(props) => props.$position}%;
  top: 0;
  width: 1px;
  height: ${(props) => props.$height}px;
  background: rgba(255, 255, 255, 0.2);
`;
var VUMeterComponent = ({
  level,
  peakLevel,
  width = 200,
  height = 20,
  className
}) => {
  const clampedLevel = Math.max(0, Math.min(1, level));
  const clampedPeak = peakLevel !== void 0 ? Math.max(0, Math.min(1, peakLevel)) : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(MeterContainer, { $width: width, $height: height, className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(MeterFill, { $level: clampedLevel, $height: height }),
    peakLevel !== void 0 && clampedPeak > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PeakIndicator, { $peakLevel: clampedPeak, $height: height }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(ScaleMarkers, { $height: height, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ScaleMark, { $position: 60, $height: height }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ScaleMark, { $position: 85, $height: height })
    ] })
  ] });
};
var VUMeter = import_react4.default.memo(VUMeterComponent);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MicrophoneSelector,
  RecordButton,
  RecordingIndicator,
  VUMeter,
  concatenateAudioData,
  createAudioBuffer,
  generatePeaks,
  useMicrophoneAccess,
  useMicrophoneLevel,
  useRecording
});
//# sourceMappingURL=index.js.map