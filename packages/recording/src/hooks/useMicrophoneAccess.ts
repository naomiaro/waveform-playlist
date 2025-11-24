/**
 * Hook for managing microphone access and device enumeration
 */

import { useState, useEffect, useCallback } from 'react';
import { UseMicrophoneAccessReturn, MicrophoneDevice } from '../types';

export function useMicrophoneAccess(): UseMicrophoneAccessReturn {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MicrophoneDevice[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Enumerate audio input devices
  const enumerateDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices
        .filter((device) => device.kind === 'audioinput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
          groupId: device.groupId,
        }));

      setDevices(audioInputs);
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
      setError(err instanceof Error ? err : new Error('Failed to enumerate devices'));
    }
  }, []);

  // Request microphone access
  const requestAccess = useCallback(async (deviceId?: string, audioConstraints?: MediaTrackConstraints) => {
    setIsLoading(true);
    setError(null);

    try {
      // Stop existing stream if any
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      // Build audio constraints
      const audio: MediaTrackConstraints & { latency?: number } = {
        // Recording-optimized defaults: prioritize raw audio quality and low latency
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        latency: 0, // Low latency mode (not in TS types yet, but supported in modern browsers)
        // User-provided constraints override defaults
        ...audioConstraints,
        // Device ID override (if specified)
        ...(deviceId && { deviceId: { exact: deviceId } }),
      };

      const constraints: MediaStreamConstraints = {
        audio,
        video: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      setHasPermission(true);

      // Enumerate devices after getting permission (labels will be available)
      await enumerateDevices();
    } catch (err) {
      console.error('Failed to access microphone:', err);
      setError(
        err instanceof Error ? err : new Error('Failed to access microphone')
      );
      setHasPermission(false);
    } finally {
      setIsLoading(false);
    }
  }, [stream, enumerateDevices]);

  // Stop the stream and revoke access
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setHasPermission(false);
    }
  }, [stream]);

  // Check initial permission state and enumerate devices
  useEffect(() => {
    // Try to enumerate devices (labels won't be available without permission)
    enumerateDevices();

    // Cleanup on unmount
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
    error,
  };
}
