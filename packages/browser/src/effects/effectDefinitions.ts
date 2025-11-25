/**
 * Effect definitions for all available Tone.js effects
 * Each effect has parameters with min/max/default values for UI controls
 */

export type ParameterType = 'number' | 'select' | 'boolean';

export interface EffectParameter {
  name: string;
  label: string;
  type: ParameterType;
  min?: number;
  max?: number;
  step?: number;
  default: number | string | boolean;
  unit?: string;
  options?: { value: string | number; label: string }[];
}

export interface EffectDefinition {
  id: string;
  name: string;
  category: 'delay' | 'reverb' | 'modulation' | 'distortion' | 'filter' | 'dynamics' | 'spatial';
  description: string;
  parameters: EffectParameter[];
}

export const effectDefinitions: EffectDefinition[] = [
  // === REVERB EFFECTS ===
  {
    id: 'reverb',
    name: 'Reverb',
    category: 'reverb',
    description: 'Simple convolution reverb with adjustable decay time',
    parameters: [
      { name: 'decay', label: 'Decay', type: 'number', min: 0.1, max: 10, step: 0.1, default: 1.5, unit: 's' },
      { name: 'wet', label: 'Mix', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5 },
    ],
  },
  {
    id: 'freeverb',
    name: 'Freeverb',
    category: 'reverb',
    description: 'Classic Schroeder/Moorer reverb with room size and dampening',
    parameters: [
      { name: 'roomSize', label: 'Room Size', type: 'number', min: 0, max: 1, step: 0.01, default: 0.7 },
      { name: 'dampening', label: 'Dampening', type: 'number', min: 0, max: 10000, step: 100, default: 3000, unit: 'Hz' },
      { name: 'wet', label: 'Mix', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5 },
    ],
  },
  {
    id: 'jcReverb',
    name: 'JC Reverb',
    category: 'reverb',
    description: 'Attempt at Roland JC-120 chorus reverb emulation',
    parameters: [
      { name: 'roomSize', label: 'Room Size', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5 },
      { name: 'wet', label: 'Mix', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5 },
    ],
  },

  // === DELAY EFFECTS ===
  {
    id: 'feedbackDelay',
    name: 'Feedback Delay',
    category: 'delay',
    description: 'Delay line with feedback for echo effects',
    parameters: [
      { name: 'delayTime', label: 'Delay Time', type: 'number', min: 0, max: 1, step: 0.01, default: 0.25, unit: 's' },
      { name: 'feedback', label: 'Feedback', type: 'number', min: 0, max: 0.95, step: 0.01, default: 0.5 },
      { name: 'wet', label: 'Mix', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5 },
    ],
  },
  {
    id: 'pingPongDelay',
    name: 'Ping Pong Delay',
    category: 'delay',
    description: 'Stereo delay bouncing between left and right channels',
    parameters: [
      { name: 'delayTime', label: 'Delay Time', type: 'number', min: 0, max: 1, step: 0.01, default: 0.25, unit: 's' },
      { name: 'feedback', label: 'Feedback', type: 'number', min: 0, max: 0.95, step: 0.01, default: 0.5 },
      { name: 'wet', label: 'Mix', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5 },
    ],
  },

  // === MODULATION EFFECTS ===
  {
    id: 'chorus',
    name: 'Chorus',
    category: 'modulation',
    description: 'Creates thickness by layering detuned copies of the signal',
    parameters: [
      { name: 'frequency', label: 'Rate', type: 'number', min: 0.1, max: 10, step: 0.1, default: 1.5, unit: 'Hz' },
      { name: 'delayTime', label: 'Delay', type: 'number', min: 0, max: 20, step: 0.5, default: 3.5, unit: 'ms' },
      { name: 'depth', label: 'Depth', type: 'number', min: 0, max: 1, step: 0.01, default: 0.7 },
      { name: 'wet', label: 'Mix', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5 },
    ],
  },
  {
    id: 'phaser',
    name: 'Phaser',
    category: 'modulation',
    description: 'Classic phaser effect using allpass filters',
    parameters: [
      { name: 'frequency', label: 'Rate', type: 'number', min: 0.1, max: 10, step: 0.1, default: 0.5, unit: 'Hz' },
      { name: 'octaves', label: 'Octaves', type: 'number', min: 1, max: 6, step: 1, default: 3 },
      { name: 'baseFrequency', label: 'Base Freq', type: 'number', min: 100, max: 2000, step: 10, default: 350, unit: 'Hz' },
      { name: 'wet', label: 'Mix', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5 },
    ],
  },
  {
    id: 'tremolo',
    name: 'Tremolo',
    category: 'modulation',
    description: 'Rhythmic volume modulation',
    parameters: [
      { name: 'frequency', label: 'Rate', type: 'number', min: 0.1, max: 20, step: 0.1, default: 4, unit: 'Hz' },
      { name: 'depth', label: 'Depth', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5 },
      { name: 'wet', label: 'Mix', type: 'number', min: 0, max: 1, step: 0.01, default: 1 },
    ],
  },
  {
    id: 'vibrato',
    name: 'Vibrato',
    category: 'modulation',
    description: 'Pitch modulation effect',
    parameters: [
      { name: 'frequency', label: 'Rate', type: 'number', min: 0.1, max: 20, step: 0.1, default: 5, unit: 'Hz' },
      { name: 'depth', label: 'Depth', type: 'number', min: 0, max: 1, step: 0.01, default: 0.1 },
      { name: 'wet', label: 'Mix', type: 'number', min: 0, max: 1, step: 0.01, default: 1 },
    ],
  },
  {
    id: 'autoPanner',
    name: 'Auto Panner',
    category: 'modulation',
    description: 'Automatic left-right panning',
    parameters: [
      { name: 'frequency', label: 'Rate', type: 'number', min: 0.1, max: 10, step: 0.1, default: 1, unit: 'Hz' },
      { name: 'depth', label: 'Depth', type: 'number', min: 0, max: 1, step: 0.01, default: 1 },
      { name: 'wet', label: 'Mix', type: 'number', min: 0, max: 1, step: 0.01, default: 1 },
    ],
  },

  // === FILTER EFFECTS ===
  {
    id: 'autoFilter',
    name: 'Auto Filter',
    category: 'filter',
    description: 'Automated filter sweep with LFO',
    parameters: [
      { name: 'frequency', label: 'Rate', type: 'number', min: 0.1, max: 10, step: 0.1, default: 1, unit: 'Hz' },
      { name: 'baseFrequency', label: 'Base Freq', type: 'number', min: 20, max: 2000, step: 10, default: 200, unit: 'Hz' },
      { name: 'octaves', label: 'Octaves', type: 'number', min: 0.5, max: 8, step: 0.5, default: 2.6 },
      { name: 'depth', label: 'Depth', type: 'number', min: 0, max: 1, step: 0.01, default: 1 },
      { name: 'wet', label: 'Mix', type: 'number', min: 0, max: 1, step: 0.01, default: 1 },
    ],
  },
  {
    id: 'autoWah',
    name: 'Auto Wah',
    category: 'filter',
    description: 'Envelope follower filter effect',
    parameters: [
      { name: 'baseFrequency', label: 'Base Freq', type: 'number', min: 20, max: 500, step: 10, default: 100, unit: 'Hz' },
      { name: 'octaves', label: 'Octaves', type: 'number', min: 1, max: 8, step: 1, default: 6 },
      { name: 'sensitivity', label: 'Sensitivity', type: 'number', min: -40, max: 0, step: 1, default: 0, unit: 'dB' },
      { name: 'wet', label: 'Mix', type: 'number', min: 0, max: 1, step: 0.01, default: 1 },
    ],
  },
  {
    id: 'eq3',
    name: '3-Band EQ',
    category: 'filter',
    description: 'Three band equalizer with low, mid, and high controls',
    parameters: [
      { name: 'low', label: 'Low', type: 'number', min: -24, max: 24, step: 0.5, default: 0, unit: 'dB' },
      { name: 'mid', label: 'Mid', type: 'number', min: -24, max: 24, step: 0.5, default: 0, unit: 'dB' },
      { name: 'high', label: 'High', type: 'number', min: -24, max: 24, step: 0.5, default: 0, unit: 'dB' },
      { name: 'lowFrequency', label: 'Low Freq', type: 'number', min: 20, max: 500, step: 10, default: 400, unit: 'Hz' },
      { name: 'highFrequency', label: 'High Freq', type: 'number', min: 1000, max: 10000, step: 100, default: 2500, unit: 'Hz' },
    ],
  },

  // === DISTORTION EFFECTS ===
  {
    id: 'distortion',
    name: 'Distortion',
    category: 'distortion',
    description: 'Wave shaping distortion effect',
    parameters: [
      { name: 'distortion', label: 'Drive', type: 'number', min: 0, max: 1, step: 0.01, default: 0.4 },
      { name: 'wet', label: 'Mix', type: 'number', min: 0, max: 1, step: 0.01, default: 1 },
    ],
  },
  {
    id: 'bitCrusher',
    name: 'Bit Crusher',
    category: 'distortion',
    description: 'Reduces bit depth for lo-fi digital texture',
    parameters: [
      { name: 'bits', label: 'Bits', type: 'number', min: 1, max: 16, step: 1, default: 4 },
      { name: 'wet', label: 'Mix', type: 'number', min: 0, max: 1, step: 0.01, default: 1 },
    ],
  },
  {
    id: 'chebyshev',
    name: 'Chebyshev',
    category: 'distortion',
    description: 'Waveshaping distortion using Chebyshev polynomials',
    parameters: [
      { name: 'order', label: 'Order', type: 'number', min: 1, max: 100, step: 1, default: 50 },
      { name: 'wet', label: 'Mix', type: 'number', min: 0, max: 1, step: 0.01, default: 1 },
    ],
  },

  // === DYNAMICS EFFECTS ===
  {
    id: 'compressor',
    name: 'Compressor',
    category: 'dynamics',
    description: 'Dynamic range compressor',
    parameters: [
      { name: 'threshold', label: 'Threshold', type: 'number', min: -60, max: 0, step: 1, default: -24, unit: 'dB' },
      { name: 'ratio', label: 'Ratio', type: 'number', min: 1, max: 20, step: 0.5, default: 4 },
      { name: 'attack', label: 'Attack', type: 'number', min: 0, max: 1, step: 0.001, default: 0.003, unit: 's' },
      { name: 'release', label: 'Release', type: 'number', min: 0, max: 1, step: 0.01, default: 0.25, unit: 's' },
      { name: 'knee', label: 'Knee', type: 'number', min: 0, max: 40, step: 1, default: 30, unit: 'dB' },
    ],
  },
  {
    id: 'limiter',
    name: 'Limiter',
    category: 'dynamics',
    description: 'Hard limiter to prevent clipping',
    parameters: [
      { name: 'threshold', label: 'Threshold', type: 'number', min: -12, max: 0, step: 0.5, default: -6, unit: 'dB' },
    ],
  },
  {
    id: 'gate',
    name: 'Gate',
    category: 'dynamics',
    description: 'Noise gate to silence signal below threshold',
    parameters: [
      { name: 'threshold', label: 'Threshold', type: 'number', min: -100, max: 0, step: 1, default: -40, unit: 'dB' },
      { name: 'attack', label: 'Attack', type: 'number', min: 0, max: 0.3, step: 0.001, default: 0.001, unit: 's' },
      { name: 'release', label: 'Release', type: 'number', min: 0, max: 0.5, step: 0.01, default: 0.1, unit: 's' },
    ],
  },

  // === SPATIAL EFFECTS ===
  {
    id: 'stereoWidener',
    name: 'Stereo Widener',
    category: 'spatial',
    description: 'Expands or narrows the stereo image',
    parameters: [
      { name: 'width', label: 'Width', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5 },
    ],
  },
];

// Helper to get effect definition by ID
export const getEffectDefinition = (id: string): EffectDefinition | undefined => {
  return effectDefinitions.find((def) => def.id === id);
};

// Helper to get effects by category
export const getEffectsByCategory = (category: EffectDefinition['category']): EffectDefinition[] => {
  return effectDefinitions.filter((def) => def.category === category);
};

// All categories with their display names
export const effectCategories: { id: EffectDefinition['category']; name: string }[] = [
  { id: 'reverb', name: 'Reverb' },
  { id: 'delay', name: 'Delay' },
  { id: 'modulation', name: 'Modulation' },
  { id: 'filter', name: 'Filter' },
  { id: 'distortion', name: 'Distortion' },
  { id: 'dynamics', name: 'Dynamics' },
  { id: 'spatial', name: 'Spatial' },
];
