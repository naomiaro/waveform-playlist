import React from 'react';

/**
 * Types for the recording package
 */
interface RecordingState {
    isRecording: boolean;
    isPaused: boolean;
    duration: number;
    sampleRate: number;
}
interface RecordingData {
    buffer: AudioBuffer | null;
    peaks: Int8Array | Int16Array;
    duration: number;
}
interface MicrophoneDevice {
    deviceId: string;
    label: string;
    groupId: string;
}
interface RecordingOptions {
    /**
     * Number of channels to record (1 = mono, 2 = stereo)
     * Default: 1 (mono)
     * Note: Sample rate is determined by the global AudioContext
     */
    channelCount?: number;
    /**
     * Samples per pixel for peak generation
     * Default: 1024
     */
    samplesPerPixel?: number;
    /**
     * Specific device ID to use for recording
     */
    deviceId?: string;
    /**
     * MediaTrackConstraints for audio recording
     * Use this to customize echo cancellation, noise suppression, auto gain control, latency, etc.
     * Default: Recording-optimized settings (all processing disabled, latency: 0 for low latency)
     */
    audioConstraints?: MediaTrackConstraints;
}
interface UseRecordingReturn {
    isRecording: boolean;
    isPaused: boolean;
    duration: number;
    peaks: Int8Array | Int16Array;
    audioBuffer: AudioBuffer | null;
    level: number;
    peakLevel: number;
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<AudioBuffer | null>;
    pauseRecording: () => void;
    resumeRecording: () => void;
    error: Error | null;
}
interface UseMicrophoneAccessReturn {
    stream: MediaStream | null;
    devices: MicrophoneDevice[];
    hasPermission: boolean;
    isLoading: boolean;
    requestAccess: (deviceId?: string, audioConstraints?: MediaTrackConstraints) => Promise<void>;
    stopStream: () => void;
    error: Error | null;
}

/**
 * Main recording hook using AudioWorklet
 */

declare function useRecording(stream: MediaStream | null, options?: RecordingOptions): UseRecordingReturn;

/**
 * Hook for managing microphone access and device enumeration
 */

declare function useMicrophoneAccess(): UseMicrophoneAccessReturn;

/**
 * Hook for monitoring microphone input levels
 *
 * Uses an AnalyserNode to provide real-time audio level monitoring
 * suitable for VU meter displays.
 */
interface UseMicrophoneLevelOptions {
    /**
     * How often to update the level (in Hz)
     * Default: 60 (60fps)
     */
    updateRate?: number;
    /**
     * FFT size for the analyser
     * Default: 256
     */
    fftSize?: number;
    /**
     * Smoothing time constant (0-1)
     * Higher values = smoother but slower response
     * Default: 0.8
     */
    smoothingTimeConstant?: number;
}
interface UseMicrophoneLevelReturn {
    /**
     * Current audio level (0-1)
     * 0 = silence, 1 = maximum level
     */
    level: number;
    /**
     * Peak level since last reset (0-1)
     */
    peakLevel: number;
    /**
     * Reset the peak level
     */
    resetPeak: () => void;
}
/**
 * Monitor microphone input levels in real-time
 *
 * @param stream - MediaStream from getUserMedia
 * @param options - Configuration options
 * @returns Object with current level and peak level
 *
 * @example
 * ```typescript
 * const { stream } = useMicrophoneAccess();
 * const { level, peakLevel, resetPeak } = useMicrophoneLevel(stream);
 *
 * return <VUMeter level={level} peakLevel={peakLevel} />;
 * ```
 */
declare function useMicrophoneLevel(stream: MediaStream | null, options?: UseMicrophoneLevelOptions): UseMicrophoneLevelReturn;

/**
 * RecordButton - Control button for starting/stopping recording
 */

interface RecordButtonProps {
    isRecording: boolean;
    onClick: () => void;
    disabled?: boolean;
    className?: string;
}
declare const RecordButton: React.FC<RecordButtonProps>;

/**
 * MicrophoneSelector - Dropdown for selecting microphone input device
 */

interface MicrophoneSelectorProps {
    devices: MicrophoneDevice[];
    selectedDeviceId?: string;
    onDeviceChange: (deviceId: string) => void;
    disabled?: boolean;
    className?: string;
}
declare const MicrophoneSelector: React.FC<MicrophoneSelectorProps>;

/**
 * RecordingIndicator - Shows recording status, duration, and visual indicator
 */

interface RecordingIndicatorProps {
    isRecording: boolean;
    isPaused?: boolean;
    duration: number;
    formatTime?: (seconds: number) => string;
    className?: string;
}
declare const RecordingIndicator: React.FC<RecordingIndicatorProps>;

/**
 * VU Meter Component
 *
 * Displays real-time audio input levels with color-coded zones
 * and peak indicator.
 */

interface VUMeterProps {
    /**
     * Current audio level (0-1)
     */
    level: number;
    /**
     * Peak level (0-1)
     * Optional - if provided, shows peak indicator
     */
    peakLevel?: number;
    /**
     * Width of the meter in pixels
     * Default: 200
     */
    width?: number;
    /**
     * Height of the meter in pixels
     * Default: 20
     */
    height?: number;
    /**
     * Additional CSS class name
     */
    className?: string;
}
declare const VUMeter: React.NamedExoticComponent<VUMeterProps>;

/**
 * Peak generation for real-time waveform visualization during recording
 * Matches the format used by webaudio-peaks: min/max pairs with bit depth
 */
/**
 * Generate peaks from audio samples in standard min/max pair format
 *
 * @param samples - Audio samples to process
 * @param samplesPerPixel - Number of samples to represent in each peak
 * @param bits - Bit depth for peak values (8 or 16)
 * @returns Int8Array or Int16Array of peak values (min/max pairs)
 */
declare function generatePeaks(samples: Float32Array, samplesPerPixel: number, bits?: 8 | 16): Int8Array | Int16Array;

/**
 * Utility functions for working with AudioBuffers during recording
 */
/**
 * Concatenate multiple Float32Arrays into a single array
 */
declare function concatenateAudioData(chunks: Float32Array[]): Float32Array;
/**
 * Convert Float32Array to AudioBuffer
 */
declare function createAudioBuffer(audioContext: AudioContext, samples: Float32Array, sampleRate: number, channelCount?: number): AudioBuffer;

export { type MicrophoneDevice, MicrophoneSelector, type MicrophoneSelectorProps, RecordButton, type RecordButtonProps, type RecordingData, RecordingIndicator, type RecordingIndicatorProps, type RecordingOptions, type RecordingState, type UseMicrophoneAccessReturn, type UseMicrophoneLevelOptions, type UseMicrophoneLevelReturn, type UseRecordingReturn, VUMeter, type VUMeterProps, concatenateAudioData, createAudioBuffer, generatePeaks, useMicrophoneAccess, useMicrophoneLevel, useRecording };
