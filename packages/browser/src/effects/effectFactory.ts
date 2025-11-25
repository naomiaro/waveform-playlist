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
} from 'tone';
import type { EffectDefinition } from './effectDefinitions';

// Type for effect instance with common methods
export interface EffectInstance {
  effect: any; // Tone.js effect instance
  id: string;
  instanceId: string;
  dispose: () => void;
  setParameter: (name: string, value: number | string | boolean) => void;
  getParameter: (name: string) => number | string | boolean | undefined;
  connect: (destination: any) => void;
  disconnect: () => void;
}

// Map of effect IDs to their Tone.js constructors
const effectConstructors: Record<string, new (options?: any) => any> = {
  reverb: Reverb,
  freeverb: Freeverb,
  jcReverb: JCReverb,
  feedbackDelay: FeedbackDelay,
  pingPongDelay: PingPongDelay,
  chorus: Chorus,
  phaser: Phaser,
  tremolo: Tremolo,
  vibrato: Vibrato,
  autoPanner: AutoPanner,
  autoFilter: AutoFilter,
  autoWah: AutoWah,
  eq3: EQ3,
  distortion: Distortion,
  bitCrusher: BitCrusher,
  chebyshev: Chebyshev,
  compressor: Compressor,
  limiter: Limiter,
  gate: Gate,
  stereoWidener: StereoWidener,
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
  const options: Record<string, any> = {};
  definition.parameters.forEach((param) => {
    const value = initialParams?.[param.name] ?? param.default;
    options[param.name] = value;
  });

  // Create the effect instance
  const effect = new Constructor(options);
  const instanceId = generateInstanceId();

  return {
    effect,
    id: definition.id,
    instanceId,

    dispose() {
      try {
        effect.disconnect();
        effect.dispose();
      } catch (e) {
        // Ignore errors during cleanup
      }
    },

    setParameter(name: string, value: number | string | boolean) {
      // Handle special cases for different effect types
      if (name === 'wet' && effect.wet) {
        effect.wet.value = value as number;
      } else if (effect[name] !== undefined) {
        // Check if it's a Tone.js Signal (has .value property)
        if (effect[name]?.value !== undefined) {
          effect[name].value = value;
        } else {
          effect[name] = value;
        }
      }
    },

    getParameter(name: string): number | string | boolean | undefined {
      if (name === 'wet' && effect.wet) {
        return effect.wet.value;
      }
      if (effect[name] !== undefined) {
        if (effect[name]?.value !== undefined) {
          return effect[name].value;
        }
        return effect[name];
      }
      return undefined;
    },

    connect(destination: any) {
      effect.connect(destination);
    },

    disconnect() {
      try {
        effect.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    },
  };
}

/**
 * Create a chain of effects connected in series
 */
export function createEffectChain(
  effects: EffectInstance[]
): {
  input: any;
  output: any;
  dispose: () => void;
} {
  if (effects.length === 0) {
    throw new Error('Cannot create effect chain with no effects');
  }

  // Connect effects in series
  for (let i = 0; i < effects.length - 1; i++) {
    effects[i].effect.connect(effects[i + 1].effect);
  }

  return {
    input: effects[0].effect,
    output: effects[effects.length - 1].effect,
    dispose() {
      effects.forEach((e) => e.dispose());
    },
  };
}
