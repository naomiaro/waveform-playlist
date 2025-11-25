// src/hooks/useRecording.ts
import { useState, useRef, useCallback, useEffect } from "react";

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
import {
  getGlobalAudioContext,
  resumeGlobalAudioContext,
  getMediaStreamSource
} from "@waveform-playlist/playout";
function useRecording(stream, options = {}) {
  const {
    channelCount = 1,
    samplesPerPixel = 1024
  } = options;
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState(new Int16Array(0));
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [error, setError] = useState(null);
  const [level, setLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const bits = 16;
  const workletLoadedRef = useRef(false);
  const workletNodeRef = useRef(null);
  const mediaStreamSourceRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const totalSamplesRef = useRef(0);
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(0);
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const loadWorklet = useCallback(async (context) => {
    if (workletLoadedRef.current) {
      return;
    }
    try {
      const workletUrl = new URL(
        "./worklet/recording-processor.worklet.js",
        import.meta.url
      ).href;
      await context.audioWorklet.addModule(workletUrl);
      workletLoadedRef.current = true;
    } catch (err) {
      console.error("Failed to load AudioWorklet module:", err);
      throw new Error("Failed to load recording processor");
    }
  }, []);
  const startRecording = useCallback(async () => {
    if (!stream) {
      setError(new Error("No microphone stream available"));
      return;
    }
    try {
      setError(null);
      const context = getGlobalAudioContext();
      await resumeGlobalAudioContext();
      await loadWorklet(context);
      const source = getMediaStreamSource(stream);
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
  const stopRecording = useCallback(async () => {
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
      const context = getGlobalAudioContext();
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
  const pauseRecording = useCallback(() => {
    if (isRecording && !isPaused) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      isPausedRef.current = true;
      setIsPaused(true);
    }
  }, [isRecording, isPaused]);
  const resumeRecording = useCallback(() => {
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
  useEffect(() => {
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
import { useState as useState2, useEffect as useEffect2, useCallback as useCallback2 } from "react";
function useMicrophoneAccess() {
  const [stream, setStream] = useState2(null);
  const [devices, setDevices] = useState2([]);
  const [hasPermission, setHasPermission] = useState2(false);
  const [isLoading, setIsLoading] = useState2(false);
  const [error, setError] = useState2(null);
  const enumerateDevices = useCallback2(async () => {
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
  const requestAccess = useCallback2(async (deviceId, audioConstraints) => {
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
  const stopStream = useCallback2(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setHasPermission(false);
    }
  }, [stream]);
  useEffect2(() => {
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
import { useEffect as useEffect3, useState as useState3, useRef as useRef2 } from "react";
import { getGlobalAudioContext as getGlobalAudioContext2, getMediaStreamSource as getMediaStreamSource2 } from "@waveform-playlist/playout";
function useMicrophoneLevel(stream, options = {}) {
  const {
    updateRate = 60,
    fftSize = 256,
    smoothingTimeConstant = 0.8
  } = options;
  const [level, setLevel] = useState3(0);
  const [peakLevel, setPeakLevel] = useState3(0);
  const analyserRef = useRef2(null);
  const sourceRef = useRef2(null);
  const animationFrameRef = useRef2(null);
  const dataArrayRef = useRef2(null);
  const resetPeak = () => setPeakLevel(0);
  useEffect3(() => {
    if (!stream) {
      setLevel(0);
      setPeakLevel(0);
      return;
    }
    let isMounted = true;
    const setupMonitoring = async () => {
      const context = getGlobalAudioContext2();
      if (!isMounted) return;
      const analyser = context.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.smoothingTimeConstant = smoothingTimeConstant;
      analyserRef.current = analyser;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;
      const source = getMediaStreamSource2(stream);
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
import styled from "styled-components";
import { jsx, jsxs } from "react/jsx-runtime";
var Button = styled.button`
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
var RecordingIndicator = styled.span`
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
  return /* @__PURE__ */ jsxs(
    Button,
    {
      $isRecording: isRecording,
      onClick,
      disabled,
      className,
      "aria-label": isRecording ? "Stop recording" : "Start recording",
      children: [
        isRecording && /* @__PURE__ */ jsx(RecordingIndicator, {}),
        isRecording ? "Stop Recording" : "Record"
      ]
    }
  );
};

// src/components/MicrophoneSelector.tsx
import styled2 from "styled-components";
import { BaseSelect, BaseLabel } from "@waveform-playlist/ui-components";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var Select = styled2(BaseSelect)`
  min-width: 200px;
`;
var Label = styled2(BaseLabel)`
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
  return /* @__PURE__ */ jsxs2(Label, { className, children: [
    "Microphone",
    /* @__PURE__ */ jsx2(
      Select,
      {
        value: currentValue,
        onChange: handleChange,
        disabled: disabled || devices.length === 0,
        children: devices.length === 0 ? /* @__PURE__ */ jsx2("option", { value: "", children: "No microphones found" }) : devices.map((device) => /* @__PURE__ */ jsx2("option", { value: device.deviceId, children: device.label }, device.deviceId))
      }
    )
  ] });
};

// src/components/RecordingIndicator.tsx
import styled3 from "styled-components";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var Container = styled3.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: ${(props) => props.$isRecording ? "#fff3cd" : "transparent"};
  border-radius: 0.25rem;
  transition: background 0.2s ease-in-out;
`;
var Dot = styled3.div`
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
var Duration = styled3.span`
  font-family: 'Courier New', Monaco, monospace;
  font-size: 1rem;
  font-weight: 600;
  color: #495057;
  min-width: 70px;
`;
var Status = styled3.span`
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
  return /* @__PURE__ */ jsxs3(Container, { $isRecording: isRecording, className, children: [
    /* @__PURE__ */ jsx3(Dot, { $isRecording: isRecording, $isPaused: isPaused }),
    /* @__PURE__ */ jsx3(Duration, { children: formatTime(duration) }),
    isRecording && /* @__PURE__ */ jsx3(Status, { $isPaused: isPaused, children: isPaused ? "Paused" : "Recording" })
  ] });
};

// src/components/VUMeter.tsx
import React from "react";
import styled4 from "styled-components";
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
var MeterContainer = styled4.div`
  position: relative;
  width: ${(props) => props.$width}px;
  height: ${(props) => props.$height}px;
  background: #2c3e50;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
`;
var MeterFill = styled4.div`
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
var PeakIndicator = styled4.div`
  position: absolute;
  left: ${(props) => props.$peakLevel * 100}%;
  top: 0;
  width: 2px;
  height: ${(props) => props.$height}px;
  background: #ecf0f1;
  box-shadow: 0 0 4px rgba(236, 240, 241, 0.8);
  transition: left 0.1s ease-out;
`;
var ScaleMarkers = styled4.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: ${(props) => props.$height}px;
  pointer-events: none;
`;
var ScaleMark = styled4.div`
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
  return /* @__PURE__ */ jsxs4(MeterContainer, { $width: width, $height: height, className, children: [
    /* @__PURE__ */ jsx4(MeterFill, { $level: clampedLevel, $height: height }),
    peakLevel !== void 0 && clampedPeak > 0 && /* @__PURE__ */ jsx4(PeakIndicator, { $peakLevel: clampedPeak, $height: height }),
    /* @__PURE__ */ jsxs4(ScaleMarkers, { $height: height, children: [
      /* @__PURE__ */ jsx4(ScaleMark, { $position: 60, $height: height }),
      /* @__PURE__ */ jsx4(ScaleMark, { $position: 85, $height: height })
    ] })
  ] });
};
var VUMeter = React.memo(VUMeterComponent);
export {
  MicrophoneSelector,
  RecordButton,
  RecordingIndicator2 as RecordingIndicator,
  VUMeter,
  concatenateAudioData,
  createAudioBuffer,
  generatePeaks,
  useMicrophoneAccess,
  useMicrophoneLevel,
  useRecording
};
//# sourceMappingURL=index.mjs.map