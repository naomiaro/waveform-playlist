import * as react from 'react';
import react__default, { FunctionComponent, ReactNode, Dispatch, SetStateAction } from 'react';
import { Peaks, Bits } from '@waveform-playlist/webaudio-peaks';
import { DraggableAttributes } from '@dnd-kit/core';
import { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import * as styled_components_dist_utils_hoist from 'styled-components/dist/utils/hoist';
import * as styled_components from 'styled-components';
import { DefaultTheme } from 'styled-components';
import * as styled_components_dist_types from 'styled-components/dist/types';
import * as _fortawesome_react_fontawesome from '@fortawesome/react-fontawesome';
import { FontAwesomeIconProps, FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import * as react_jsx_runtime from 'react/jsx-runtime';

interface AudioPositionProps {
    formattedTime: string;
    className?: string;
}
/**
 * Displays the current audio playback position
 */
declare const AudioPosition: react__default.FC<AudioPositionProps>;

interface AutomaticScrollCheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
}
/**
 * Checkbox control for enabling/disabling automatic scroll during playback
 */
declare const AutomaticScrollCheckbox: react__default.FC<AutomaticScrollCheckboxProps>;

interface ChannelProps {
    className?: string;
    index: number;
    data: Peaks;
    bits: Bits;
    length: number;
    progress?: number;
    devicePixelRatio?: number;
    waveHeight?: number;
    waveProgressColor?: string;
    waveOutlineColor?: string;
    waveFillColor?: string;
}
declare const Channel: FunctionComponent<ChannelProps>;

interface ClipProps {
    className?: string;
    children?: ReactNode;
    clipId: string;
    trackIndex: number;
    clipIndex: number;
    trackName: string;
    startSample: number;
    durationSamples: number;
    samplesPerPixel: number;
    showHeader?: boolean;
    disableHeaderDrag?: boolean;
    isOverlay?: boolean;
    isSelected?: boolean;
    onMouseDown?: (e: react__default.MouseEvent<HTMLDivElement>) => void;
    trackId?: string;
}
/**
 * Clip component for rendering individual audio clips within a track
 *
 * Each clip is positioned based on its startTime and has a width based on its duration.
 * This allows multiple clips to be arranged on a single track with gaps or overlaps.
 *
 * Includes a draggable ClipHeader at the top for repositioning clips on the timeline.
 */
declare const Clip: FunctionComponent<ClipProps>;

declare const CLIP_HEADER_HEIGHT = 22;
interface ClipHeaderPresentationalProps {
    trackName: string;
    isSelected?: boolean;
}
declare const ClipHeaderPresentational: FunctionComponent<ClipHeaderPresentationalProps>;
interface DragHandleProps$1 {
    attributes: DraggableAttributes;
    listeners: SyntheticListenerMap | undefined;
    setActivatorNodeRef: (element: HTMLElement | null) => void;
}
interface ClipHeaderProps {
    clipId: string;
    trackIndex: number;
    clipIndex: number;
    trackName: string;
    isSelected?: boolean;
    disableDrag?: boolean;
    dragHandleProps?: DragHandleProps$1;
}
/**
 * ClipHeader component - Draggable title bar for audio clips
 *
 * Renders at the top of each clip (above all channels).
 * Drag the header to move the clip along the timeline.
 * Shows the track name (not clip-specific info).
 *
 * Theme colors (from useTheme):
 * - clipHeaderBackgroundColor / selectedClipHeaderBackgroundColor
 * - clipHeaderBorderColor
 * - clipHeaderTextColor
 */
declare const ClipHeader: FunctionComponent<ClipHeaderProps>;

declare const CLIP_BOUNDARY_WIDTH = 8;
type BoundaryEdge = 'left' | 'right';
interface DragHandleProps extends DragHandleProps$1 {
    isDragging?: boolean;
}
interface ClipBoundaryProps {
    clipId: string;
    trackIndex: number;
    clipIndex: number;
    edge: BoundaryEdge;
    dragHandleProps?: DragHandleProps;
}
/**
 * ClipBoundary component - Draggable edge for trimming clips
 *
 * Renders at the left or right edge of a clip.
 * Drag to trim the clip (adjust offset and duration).
 * Supports bidirectional trimming (trim in and out).
 */
declare const ClipBoundary: FunctionComponent<ClipBoundaryProps>;

interface MasterVolumeControlProps {
    volume: number;
    onChange: (volume: number) => void;
    disabled?: boolean;
    className?: string;
}
/**
 * Master volume control slider component
 * Accepts volume as 0-1.0 range (linear gain) and displays as percentage
 */
declare const MasterVolumeControl: react__default.FC<MasterVolumeControlProps>;

interface PlayheadProps {
    position: number;
    color?: string;
}
declare const Playhead: react__default.FC<PlayheadProps>;

interface PlaylistProps {
    readonly theme: DefaultTheme;
    readonly children?: JSX.Element | JSX.Element[];
    readonly backgroundColor?: string;
    readonly timescaleBackgroundColor?: string;
    readonly timescale?: JSX.Element;
    readonly timescaleWidth?: number;
    readonly tracksWidth?: number;
    readonly scrollContainerWidth?: number;
    readonly controlsWidth?: number;
    readonly onTracksClick?: (e: react__default.MouseEvent<HTMLDivElement>) => void;
    readonly onTracksMouseDown?: (e: react__default.MouseEvent<HTMLDivElement>) => void;
    readonly onTracksMouseMove?: (e: react__default.MouseEvent<HTMLDivElement>) => void;
    readonly onTracksMouseUp?: (e: react__default.MouseEvent<HTMLDivElement>) => void;
    readonly scrollContainerRef?: (el: HTMLDivElement | null) => void;
}
declare const Playlist: FunctionComponent<PlaylistProps>;
declare const StyledPlaylist: react__default.ForwardRefExoticComponent<styled_components.ExecutionProps & react__default.RefAttributes<react__default.FunctionComponent<PlaylistProps>>> & styled_components_dist_utils_hoist.NonReactStatics<react__default.FunctionComponent<PlaylistProps>>;

interface SelectionProps {
    startPosition: number;
    endPosition: number;
    color?: string;
}
declare const Selection: react__default.FC<SelectionProps>;

interface SelectionTimeInputsProps {
    selectionStart: number;
    selectionEnd: number;
    onSelectionChange?: (start: number, end: number) => void;
    className?: string;
}
declare const SelectionTimeInputs: react__default.FC<SelectionTimeInputsProps>;

interface SmartChannelProps {
    className?: string;
    index: number;
    data: Int8Array | Int16Array;
    bits: 8 | 16;
    length: number;
    progress?: number;
    isSelected?: boolean;
}
declare const SmartChannel: FunctionComponent<SmartChannelProps>;

declare const SmartScale: FunctionComponent;

/**
 * Time format utilities for displaying and parsing audio timestamps
 */
type TimeFormat = 'seconds' | 'thousandths' | 'hh:mm:ss' | 'hh:mm:ss.u' | 'hh:mm:ss.uu' | 'hh:mm:ss.uuu';
/**
 * Format seconds according to the specified format
 */
declare function formatTime(seconds: number, format: TimeFormat): string;
/**
 * Parse a formatted time string back to seconds
 */
declare function parseTime(timeStr: string, format: TimeFormat): number;

interface TimeFormatSelectProps {
    value: TimeFormat;
    onChange: (format: TimeFormat) => void;
    disabled?: boolean;
    className?: string;
}
/**
 * Dropdown select for choosing time display format
 */
declare const TimeFormatSelect: react__default.FC<TimeFormatSelectProps>;

interface TimeInputProps {
    id: string;
    label: string;
    value: number;
    format: TimeFormat;
    className?: string;
    onChange?: (value: number) => void;
    readOnly?: boolean;
}
/**
 * TimeInput - A styled input for time values with format support
 *
 * Uses BaseInput for consistent theming. Displays time in the specified
 * format and parses user input on blur.
 */
declare const TimeInput: react__default.FC<TimeInputProps>;

interface TimeScaleProps {
    readonly theme?: DefaultTheme;
    readonly duration: number;
    readonly marker: number;
    readonly bigStep: number;
    readonly secondStep: number;
    readonly renderTimestamp?: (timeMs: number, pixelPosition: number) => react__default.ReactNode;
}
interface TimeScalePropsWithTheme extends TimeScaleProps {
    readonly theme: DefaultTheme;
}
declare const TimeScale: FunctionComponent<TimeScalePropsWithTheme>;
declare const StyledTimeScale: FunctionComponent<TimeScaleProps>;

interface ControlsWrapperProps {
    readonly $controlWidth: number;
    readonly $isSelected?: boolean;
}
interface TrackProps {
    className?: string;
    children?: ReactNode;
    numChannels: number;
    backgroundColor?: string;
    offset?: number;
    width?: number;
    hasClipHeaders?: boolean;
    onClick?: () => void;
    trackId?: string;
    isSelected?: boolean;
}
declare const Track: FunctionComponent<TrackProps>;

/**
 * TrackControls Button - Small button for track controls (Mute, Solo, etc.)
 *
 * Supports variants: outline (default), danger, info
 * Uses theme values for consistent styling.
 */
declare const Button: styled_components_dist_types.IStyledComponentBase<"web", styled_components_dist_types.Substitute<styled_components.FastOmit<styled_components_dist_types.Substitute<react.DetailedHTMLProps<react.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, Omit<react.DetailedHTMLProps<react.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, "ref"> & {
    ref?: ((instance: HTMLButtonElement | null) => void | react.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof react.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | react.RefObject<HTMLButtonElement> | null | undefined;
}>, never>, {
    $variant?: "outline" | "danger" | "info";
}>> & string;

declare const ButtonGroup: styled_components_dist_types.IStyledComponentBase<"web", styled_components.FastOmit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, never>> & string;

declare const Controls$1: styled_components_dist_types.IStyledComponentBase<"web", styled_components.FastOmit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, never>> & string;

declare const Header: styled_components_dist_types.IStyledComponentBase<"web", styled_components.FastOmit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLElement>, HTMLElement>, never>> & string;

declare const VolumeDownIcon: react__default.FC<Omit<FontAwesomeIconProps, 'icon'>>;

declare const VolumeUpIcon: react__default.FC<Omit<FontAwesomeIconProps, 'icon'>>;

declare const TrashIcon: styled_components_dist_types.IStyledComponentBase<"web", styled_components.FastOmit<styled_components.FastOmit<styled_components_dist_types.Substitute<Omit<_fortawesome_react_fontawesome.FontAwesomeIconProps, "ref"> & {
    ref?: ((instance: SVGSVGElement | null) => void | react.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof react.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | react.RefObject<SVGSVGElement> | null | undefined;
}, Omit<_fortawesome_react_fontawesome.FontAwesomeIconProps, "ref"> & {
    ref?: ((instance: SVGSVGElement | null) => void | react.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof react.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | react.RefObject<SVGSVGElement> | null | undefined;
}>, never>, never>> & string & Omit<typeof FontAwesomeIcon, keyof react.Component<any, {}, any>>;

/**
 * TrackControls Slider - Compact slider for volume/pan controls
 *
 * Extends BaseSlider with track-specific styling:
 * - Smaller thumb and track for compact layout
 * - Uses theme's sliderThumbColor (goldenrod by default)
 */
declare const Slider: styled_components_dist_types.IStyledComponentBase<"web", styled_components.FastOmit<styled_components.FastOmit<styled_components.FastOmit<styled_components_dist_types.Substitute<react.DetailedHTMLProps<react.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>, Omit<react.DetailedHTMLProps<react.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>, "ref"> & {
    ref?: ((instance: HTMLInputElement | null) => void | react.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof react.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | react.RefObject<HTMLInputElement> | null | undefined;
}>, never>, never>, never>> & string;

declare const SliderWrapper: styled_components_dist_types.IStyledComponentBase<"web", styled_components.FastOmit<react.DetailedHTMLProps<react.LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>, never>> & string;

/**
 * Track Controls with Delete Button
 *
 * Reusable track controls component that includes standard controls
 * (mute, solo, volume, pan) plus a delete button
 */

interface TrackControlsWithDeleteProps {
    trackIndex: number;
    trackName: string;
    muted: boolean;
    soloed: boolean;
    volume: number;
    pan: number;
    onMuteChange: (muted: boolean) => void;
    onSoloChange: (soloed: boolean) => void;
    onVolumeChange: (volume: number) => void;
    onPanChange: (pan: number) => void;
    onDelete: () => void;
}
/**
 * Track controls with delete button
 *
 * @example
 * ```tsx
 * <TrackControlsWithDelete
 *   trackIndex={0}
 *   trackName="Track 1"
 *   muted={false}
 *   soloed={false}
 *   volume={1.0}
 *   pan={0}
 *   onMuteChange={(muted) => console.log('mute:', muted)}
 *   onSoloChange={(soloed) => console.log('solo:', soloed)}
 *   onVolumeChange={(volume) => console.log('volume:', volume)}
 *   onPanChange={(pan) => console.log('pan:', pan)}
 *   onDelete={() => console.log('delete')}
 * />
 * ```
 */
declare const TrackControlsWithDelete: react__default.FC<TrackControlsWithDeleteProps>;

type Props$1 = {
    children: ReactNode;
};
declare const DevicePixelRatioProvider: ({ children }: Props$1) => react_jsx_runtime.JSX.Element;
declare const useDevicePixelRatio: () => number;

type Controls = {
    show: boolean;
    width: number;
};
type PlaylistInfo = {
    sampleRate: number;
    samplesPerPixel: number;
    zoomLevels: Array<number>;
    waveHeight: number;
    timeScaleHeight: number;
    duration: number;
    controls: Controls;
};
declare const PlaylistInfoContext: react.Context<PlaylistInfo>;
declare const usePlaylistInfo: () => PlaylistInfo;

declare const useTheme: () => styled_components.DefaultTheme | undefined;

declare const TrackControlsContext: react__default.Context<react__default.ReactNode>;
declare const useTrackControls: () => react__default.ReactNode;

type PlayoutStatusUpdate = {
    setIsPlaying: Dispatch<SetStateAction<boolean>>;
    setProgress: Dispatch<SetStateAction<number>>;
    setSelection: (start: number, end: number) => void;
};
type Props = {
    children: ReactNode;
};
declare const PlayoutProvider: ({ children }: Props) => react_jsx_runtime.JSX.Element;
declare const usePlayoutStatus: () => {
    progress: number;
    isPlaying: boolean;
    selectionStart: number;
    selectionEnd: number;
};
declare const usePlayoutStatusUpdate: () => PlayoutStatusUpdate;

declare function samplesToSeconds(samples: number, sampleRate: number): number;
declare function secondsToSamples(seconds: number, sampleRate: number): number;
declare function samplesToPixels(samples: number, samplesPerPixel: number): number;
declare function pixelsToSamples(pixels: number, samplesPerPixel: number): number;
declare function pixelsToSeconds(pixels: number, samplesPerPixel: number, sampleRate: number): number;
declare function secondsToPixels(seconds: number, samplesPerPixel: number, sampleRate: number): number;

/**
 * BaseButton - A styled button component that uses theme values
 *
 * This provides consistent styling across all button elements in the waveform playlist.
 */
declare const BaseButton: styled_components_dist_types.IStyledComponentBase<"web", styled_components.FastOmit<react.DetailedHTMLProps<react.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, never>> & string;

/**
 * BaseCheckboxWrapper - Container for checkbox + label
 */
declare const BaseCheckboxWrapper: styled_components_dist_types.IStyledComponentBase<"web", styled_components.FastOmit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, never>> & string;
/**
 * BaseCheckbox - A styled checkbox input
 */
declare const BaseCheckbox: styled_components_dist_types.IStyledComponentBase<"web", styled_components.FastOmit<react.DetailedHTMLProps<react.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>, never>> & string;
/**
 * BaseCheckboxLabel - Label for checkboxes
 */
declare const BaseCheckboxLabel: styled_components_dist_types.IStyledComponentBase<"web", styled_components.FastOmit<react.DetailedHTMLProps<react.LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>, never>> & string;

interface ControlButtonProps {
    variant?: 'primary' | 'success' | 'info';
}
/**
 * ControlButton - A colored action button (primary/success/info variants)
 *
 * This is used for prominent actions like Play, Pause, Record.
 * For neutral buttons, use BaseButton from the styled primitives.
 */
declare const BaseControlButton: styled_components_dist_types.IStyledComponentBase<"web", styled_components_dist_types.Substitute<react.DetailedHTMLProps<react.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, ControlButtonProps>> & string;

/**
 * BaseInput - A styled input component that uses theme values
 *
 * This provides consistent styling across all input elements in the waveform playlist.
 * Styling is controlled via the theme, making it easy to adapt to different environments.
 */
declare const BaseInput: styled_components_dist_types.IStyledComponentBase<"web", styled_components.FastOmit<react.DetailedHTMLProps<react.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>, never>> & string;

/**
 * BaseLabel - A styled label component that uses theme values
 */
declare const BaseLabel: styled_components_dist_types.IStyledComponentBase<"web", styled_components.FastOmit<react.DetailedHTMLProps<react.LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>, never>> & string;
/**
 * InlineLabel - A label that displays inline with its input
 */
declare const InlineLabel: styled_components_dist_types.IStyledComponentBase<"web", styled_components.FastOmit<react.DetailedHTMLProps<react.LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>, never>> & string;
/**
 * ScreenReaderOnly - Visually hidden but accessible to screen readers
 */
declare const ScreenReaderOnly: styled_components_dist_types.IStyledComponentBase<"web", styled_components.FastOmit<react.DetailedHTMLProps<react.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>, never>> & string;

/**
 * BaseSelect - A styled select component that uses theme values
 *
 * This provides consistent styling across all select elements in the waveform playlist.
 */
declare const BaseSelect: styled_components_dist_types.IStyledComponentBase<"web", styled_components.FastOmit<react.DetailedHTMLProps<react.SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement>, never>> & string;

/**
 * BaseSlider - Themed range input for volume controls, etc.
 *
 * Uses theme values for consistent styling across light/dark modes.
 * Provides custom styling for the track and thumb.
 */
declare const BaseSlider: styled_components_dist_types.IStyledComponentBase<"web", styled_components.FastOmit<styled_components.FastOmit<styled_components_dist_types.Substitute<react.DetailedHTMLProps<react.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>, Omit<react.DetailedHTMLProps<react.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>, "ref"> & {
    ref?: ((instance: HTMLInputElement | null) => void | react.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES[keyof react.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES]) | react.RefObject<HTMLInputElement> | null | undefined;
}>, never>, never>> & string;

/**
 * Waveform Playlist Theme
 *
 * This file defines the theme interface and default values for the waveform playlist components.
 */
interface WaveformPlaylistTheme {
    waveOutlineColor: string;
    waveFillColor: string;
    waveProgressColor: string;
    selectedWaveOutlineColor: string;
    selectedWaveFillColor: string;
    selectedTrackControlsBackground: string;
    timeColor: string;
    timescaleBackgroundColor: string;
    playheadColor: string;
    selectionColor: string;
    clipHeaderBackgroundColor: string;
    clipHeaderBorderColor: string;
    clipHeaderTextColor: string;
    selectedClipHeaderBackgroundColor: string;
    backgroundColor: string;
    surfaceColor: string;
    borderColor: string;
    textColor: string;
    textColorMuted: string;
    inputBackground: string;
    inputBorder: string;
    inputText: string;
    inputPlaceholder: string;
    inputFocusBorder: string;
    buttonBackground: string;
    buttonText: string;
    buttonBorder: string;
    buttonHoverBackground: string;
    sliderTrackColor: string;
    sliderThumbColor: string;
    annotationBoxBackground: string;
    annotationBoxActiveBackground: string;
    annotationBoxHoverBackground: string;
    annotationBoxBorder: string;
    annotationBoxActiveBorder: string;
    annotationLabelColor: string;
    annotationResizeHandleColor: string;
    annotationResizeHandleActiveColor: string;
    annotationTextItemHoverBackground: string;
    borderRadius: string;
    fontFamily: string;
    fontSize: string;
    fontSizeSmall: string;
}
declare const defaultTheme: WaveformPlaylistTheme;
declare const darkTheme: WaveformPlaylistTheme;

export { AudioPosition, type AudioPositionProps, AutomaticScrollCheckbox, type AutomaticScrollCheckboxProps, BaseButton, BaseCheckbox, BaseCheckboxLabel, BaseCheckboxWrapper, BaseControlButton, BaseInput, BaseLabel, BaseSelect, BaseSlider, Button, ButtonGroup, CLIP_BOUNDARY_WIDTH, CLIP_HEADER_HEIGHT, Channel, type ChannelProps, Clip, ClipBoundary, type ClipBoundaryProps, ClipHeader, ClipHeaderPresentational, type ClipHeaderPresentationalProps, type ClipHeaderProps, type ClipProps, Controls$1 as Controls, type ControlsWrapperProps, DevicePixelRatioProvider, type DragHandleProps$1 as DragHandleProps, Header, InlineLabel, MasterVolumeControl, type MasterVolumeControlProps, Playhead, type PlayheadProps, Playlist, PlaylistInfoContext, type PlaylistProps, PlayoutProvider, ScreenReaderOnly, Selection, type SelectionProps, SelectionTimeInputs, type SelectionTimeInputsProps, Slider, SliderWrapper, SmartChannel, type SmartChannelProps, SmartScale, StyledPlaylist, StyledTimeScale, type TimeFormat, TimeFormatSelect, type TimeFormatSelectProps, TimeInput, type TimeInputProps, TimeScale, type TimeScaleProps, Track, TrackControlsContext, TrackControlsWithDelete, type TrackControlsWithDeleteProps, type TrackProps, TrashIcon, VolumeDownIcon, VolumeUpIcon, type WaveformPlaylistTheme, darkTheme, defaultTheme, formatTime, parseTime, pixelsToSamples, pixelsToSeconds, samplesToPixels, samplesToSeconds, secondsToPixels, secondsToSamples, useDevicePixelRatio, usePlaylistInfo, usePlayoutStatus, usePlayoutStatusUpdate, useTheme, useTrackControls };
