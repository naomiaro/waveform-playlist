/**
 * Factory for creating Tone.js effect instances from effect definitions
 */
import {
  Reverb,
  Freeverb,
  JCReverb,
  FeedbackDelay,
  PingPongDelay,
  Chorus,
  Phaser,
  Tremolo,
  Vibrato,
  AutoPanner,
  AutoFilter,
  AutoWah,
  EQ3,
  Distortion,
  BitCrusher,
  Chebyshev,
  Compressor,
  Limiter,
  Gate,
  StereoWidener,
  ToneAudioNode,
  connect,
} from 'tone';
import type { InputNode } from 'tone';
import type { EffectDefinition } from './effectDefinitions';

// Type for effect instance with common methods
export interface EffectInstance {
  effect: ToneAudioNode | AudioNode; // Tone.js effect, or a native node (WAM plugins)
  id: string;
  instanceId: string;
  dispose: () => void;
  setParameter: (name: string, value: number | string | boolean) => void;
  getParameter: (name: string) => number | string | boolean | undefined;
  connect: (destination: InputNode) => void;
  disconnect: () => void;
}

// Each Tone.js effect constructor accepts different option types (ReverbOptions,
// ChorusOptions, etc.) but all produce ToneAudioNode subclasses. We use a
// permissive constructor signature to unify them in a single lookup map.
type EffectConstructor = new (options?: Record<string, number | string | boolean>) => ToneAudioNode;

/** Centralizes the single unavoidable cast from a specific Tone.js effect constructor to EffectConstructor. */
function asEffectConstructor(ctor: new (...args: never[]) => ToneAudioNode): EffectConstructor {
  return ctor as unknown as EffectConstructor;
}

// Map of effect IDs to their Tone.js constructors
const effectConstructors: Record<string, EffectConstructor> = {
  reverb: asEffectConstructor(Reverb),
  freeverb: asEffectConstructor(Freeverb),
  jcReverb: asEffectConstructor(JCReverb),
  feedbackDelay: asEffectConstructor(FeedbackDelay),
  pingPongDelay: asEffectConstructor(PingPongDelay),
  chorus: asEffectConstructor(Chorus),
  phaser: asEffectConstructor(Phaser),
  tremolo: asEffectConstructor(Tremolo),
  vibrato: asEffectConstructor(Vibrato),
  autoPanner: asEffectConstructor(AutoPanner),
  autoFilter: asEffectConstructor(AutoFilter),
  autoWah: asEffectConstructor(AutoWah),
  eq3: asEffectConstructor(EQ3),
  distortion: asEffectConstructor(Distortion),
  bitCrusher: asEffectConstructor(BitCrusher),
  chebyshev: asEffectConstructor(Chebyshev),
  compressor: asEffectConstructor(Compressor),
  limiter: asEffectConstructor(Limiter),
  gate: asEffectConstructor(Gate),
  stereoWidener: asEffectConstructor(StereoWidener),
};

// Generate unique instance ID
let instanceCounter = 0;
const generateInstanceId = (): string => {
  return `effect_${Date.now()}_${++instanceCounter}`;
};

/**
 * Create an effect instance from a definition with initial parameter values
 */
export function createEffectInstance(
  definition: EffectDefinition,
  initialParams?: Record<string, number | string | boolean>
): EffectInstance {
  const Constructor = effectConstructors[definition.id];
  if (!Constructor) {
    throw new Error(`Unknown effect type: ${definition.id}`);
  }

  // Build initial options from definition defaults and any overrides
  const options: Record<string, number | string | boolean> = {};
  definition.parameters.forEach((param) => {
    const value = initialParams?.[param.name] ?? param.default;
    options[param.name] = value;
  });

  // Create the effect instance
  const effect = new Constructor(options);
  const instanceId = generateInstanceId();

  // Dynamic property access on Tone.js effects for parameter get/set.
  // Each effect type (Reverb, Chorus, EQ3, etc.) exposes different parameters as
  // properties or Signals. We cast to a record type for safe dynamic access.
  const effectRecord = effect as unknown as Record<string, { value?: unknown } | unknown>;

  return {
    effect,
    id: definition.id,
    instanceId,

    dispose() {
      try {
        effect.disconnect();
        effect.dispose();
      } catch (e) {
        console.warn(
          `[waveform-playlist] Error disposing effect "${definition.id}" (${instanceId}):`,
          e
        );
      }
    },

    setParameter(name: string, value: number | string | boolean) {
      // Handle special cases for different effect types
      const prop = effectRecord[name];
      if (name === 'wet') {
        const wetProp = effectRecord['wet'] as { value?: number } | undefined;
        if (wetProp && typeof wetProp === 'object' && 'value' in wetProp) {
          wetProp.value = value as number;
          return;
        }
      }
      if (prop !== undefined) {
        // Check if it's a Tone.js Signal (has .value property)
        if (prop && typeof prop === 'object' && 'value' in prop) {
          (prop as { value: unknown }).value = value;
        } else {
          effectRecord[name] = value;
        }
      }
    },

    getParameter(name: string): number | string | boolean | undefined {
      if (name === 'wet') {
        const wetProp = effectRecord['wet'] as { value?: number } | undefined;
        if (wetProp && typeof wetProp === 'object' && 'value' in wetProp) {
          return wetProp.value;
        }
      }
      const prop = effectRecord[name];
      if (prop !== undefined) {
        if (prop && typeof prop === 'object' && 'value' in prop) {
          return (prop as { value: unknown }).value as number | string | boolean;
        }
        return prop as number | string | boolean;
      }
      return undefined;
    },

    connect(destination: InputNode) {
      effect.connect(destination);
    },

    disconnect() {
      try {
        effect.disconnect();
      } catch (e) {
        console.warn(
          `[waveform-playlist] Error disconnecting effect "${definition.id}" (${instanceId}):`,
          e
        );
      }
    },
  };
}

/**
 * Create a chain of effects connected in series
 */
export function createEffectChain(effects: EffectInstance[]): {
  input: ToneAudioNode | AudioNode;
  output: ToneAudioNode | AudioNode;
  dispose: () => void;
} {
  if (effects.length === 0) {
    throw new Error('Cannot create effect chain with no effects');
  }

  // Connect effects in series
  for (let i = 0; i < effects.length - 1; i++) {
    connect(effects[i].effect, effects[i + 1].effect);
  }

  return {
    input: effects[0].effect,
    output: effects[effects.length - 1].effect,
    dispose() {
      effects.forEach((e) => e.dispose());
    },
  };
}
