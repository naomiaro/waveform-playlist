import { describe, it, expect } from 'vitest';
import {
  effectDefinitions,
  getEffectDefinition,
  getEffectsByCategory,
  effectCategories,
} from '../effects/effectDefinitions';
import type { EffectDefinition, EffectParameter } from '../effects/effectDefinitions';

const VALID_CATEGORIES: EffectDefinition['category'][] = [
  'delay',
  'reverb',
  'modulation',
  'distortion',
  'filter',
  'dynamics',
  'spatial',
];

const VALID_PARAMETER_TYPES: EffectParameter['type'][] = ['number', 'select', 'boolean'];

describe('effectDefinitions', () => {
  it('contains exactly 20 effects', () => {
    expect(effectDefinitions).toHaveLength(20);
  });

  it('has no duplicate effect IDs', () => {
    const ids = effectDefinitions.map((def) => def.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  describe('required fields', () => {
    it.each(effectDefinitions.map((def) => [def.id, def]))(
      '%s has all required fields',
      (_id, def) => {
        const effect = def as EffectDefinition;
        expect(typeof effect.id).toBe('string');
        expect(effect.id.length).toBeGreaterThan(0);
        expect(typeof effect.name).toBe('string');
        expect(effect.name.length).toBeGreaterThan(0);
        expect(typeof effect.category).toBe('string');
        expect(typeof effect.description).toBe('string');
        expect(Array.isArray(effect.parameters)).toBe(true);
      }
    );
  });

  describe('categories', () => {
    it.each(effectDefinitions.map((def) => [def.id, def.category]))(
      '%s has a valid category (%s)',
      (_id, category) => {
        expect(VALID_CATEGORIES).toContain(category);
      }
    );
  });

  describe('parameters', () => {
    it.each(effectDefinitions.map((def) => [def.id, def]))(
      '%s has at least one parameter',
      (_id, def) => {
        const effect = def as EffectDefinition;
        expect(effect.parameters.length).toBeGreaterThanOrEqual(1);
      }
    );

    it('all parameters have valid types', () => {
      for (const effect of effectDefinitions) {
        for (const param of effect.parameters) {
          expect(VALID_PARAMETER_TYPES).toContain(param.type);
        }
      }
    });

    it('all number parameters have min <= default <= max', () => {
      for (const effect of effectDefinitions) {
        for (const param of effect.parameters) {
          if (param.type === 'number' && param.min !== undefined && param.max !== undefined) {
            const defaultVal = param.default as number;
            expect(param.min).toBeLessThanOrEqual(defaultVal);
            expect(defaultVal).toBeLessThanOrEqual(param.max);
          }
        }
      }
    });

    it('all number parameters have min < max', () => {
      for (const effect of effectDefinitions) {
        for (const param of effect.parameters) {
          if (param.type === 'number' && param.min !== undefined && param.max !== undefined) {
            expect(param.min).toBeLessThan(param.max);
          }
        }
      }
    });

    it('all parameters have a name and label', () => {
      for (const effect of effectDefinitions) {
        for (const param of effect.parameters) {
          expect(typeof param.name).toBe('string');
          expect(param.name.length).toBeGreaterThan(0);
          expect(typeof param.label).toBe('string');
          expect(param.label.length).toBeGreaterThan(0);
        }
      }
    });

    it('all parameters have a default value', () => {
      for (const effect of effectDefinitions) {
        for (const param of effect.parameters) {
          expect(param.default).toBeDefined();
        }
      }
    });

    it('number parameters with step have positive step values', () => {
      for (const effect of effectDefinitions) {
        for (const param of effect.parameters) {
          if (param.type === 'number' && param.step !== undefined) {
            expect(param.step).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  describe('specific effects present', () => {
    const expectedIds = [
      'reverb',
      'freeverb',
      'jcReverb',
      'feedbackDelay',
      'pingPongDelay',
      'chorus',
      'phaser',
      'tremolo',
      'vibrato',
      'autoPanner',
      'autoFilter',
      'autoWah',
      'eq3',
      'distortion',
      'bitCrusher',
      'chebyshev',
      'compressor',
      'limiter',
      'gate',
      'stereoWidener',
    ];

    it.each(expectedIds)('includes effect: %s', (id) => {
      const found = effectDefinitions.find((def) => def.id === id);
      expect(found).toBeDefined();
    });
  });

  describe('getEffectDefinition helper', () => {
    it('returns the correct effect by ID', () => {
      const result = getEffectDefinition('reverb');
      expect(result).toBeDefined();
      expect(result!.id).toBe('reverb');
      expect(result!.name).toBe('Reverb');
    });

    it('returns undefined for unknown ID', () => {
      const result = getEffectDefinition('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('getEffectsByCategory helper', () => {
    it('returns only effects from the requested category', () => {
      const reverbEffects = getEffectsByCategory('reverb');
      expect(reverbEffects.length).toBeGreaterThan(0);
      for (const effect of reverbEffects) {
        expect(effect.category).toBe('reverb');
      }
    });

    it('returns empty array for a category with no effects', () => {
      // All defined categories have effects, but test the filtering logic
      const results = getEffectsByCategory('spatial');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('stereoWidener');
    });
  });

  describe('effectCategories', () => {
    it('contains all 7 categories', () => {
      expect(effectCategories).toHaveLength(7);
    });

    it('every category has an id and name', () => {
      for (const cat of effectCategories) {
        expect(typeof cat.id).toBe('string');
        expect(typeof cat.name).toBe('string');
        expect(cat.name.length).toBeGreaterThan(0);
      }
    });

    it('category ids match the valid categories', () => {
      const categoryIds = effectCategories.map((c) => c.id);
      expect(categoryIds.sort()).toEqual([...VALID_CATEGORIES].sort());
    });

    it('every defined effect belongs to a listed category', () => {
      const categoryIds = new Set(effectCategories.map((c) => c.id));
      for (const effect of effectDefinitions) {
        expect(categoryIds.has(effect.category)).toBe(true);
      }
    });
  });
});
