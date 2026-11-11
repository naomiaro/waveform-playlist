import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildTrackFromConfig, duplicateTrackIds } from '../buildTrackFromConfig';
import type { AudioTrackConfig } from '../useAudioTracks';

const stableIds = () => new Map<number, { trackId: string; clipId: string }>();

describe('buildTrackFromConfig', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('builds a track when the config provides a duration', () => {
    const config: AudioTrackConfig = { src: 'a.opus', name: 'A', duration: 10 };
    const track = buildTrackFromConfig(config, 0, undefined, stableIds(), 48000);
    expect(track).not.toBeNull();
    expect(track?.clips[0].durationSamples).toBe(10 * 48000);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns null and warns when duration is underivable (terminal case)', () => {
    const config: AudioTrackConfig = { src: 'a.opus', name: 'A' };
    const track = buildTrackFromConfig(config, 0, undefined, stableIds(), 48000);
    expect(track).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('Cannot create track');
  });

  it('returns null SILENTLY when the missing duration is a pending decode (immediate mode)', () => {
    const config: AudioTrackConfig = { src: 'a.opus', name: 'A' };
    const track = buildTrackFromConfig(config, 0, undefined, stableIds(), 48000, {
      suppressMissingDurationWarning: true,
    });
    expect(track).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('preserves stable ids across rebuilds', () => {
    const ids = stableIds();
    const config: AudioTrackConfig = { src: 'a.opus', name: 'A', duration: 5 };
    const first = buildTrackFromConfig(config, 0, undefined, ids, 48000);
    const second = buildTrackFromConfig(config, 0, undefined, ids, 48000);
    expect(second?.id).toBe(first?.id);
    expect(second?.clips[0].id).toBe(first?.clips[0].id);
  });

  // #752: an app that keys something on a track (the provider's
  // `trackEffects`) needs an id it knows before the track exists.
  it('uses the id given in the config as the track id', () => {
    const ids = stableIds();
    const config: AudioTrackConfig = { id: 'vocals', src: 'a.opus', name: 'A', duration: 5 };
    const first = buildTrackFromConfig(config, 0, undefined, ids, 48000);
    const second = buildTrackFromConfig(config, 0, undefined, ids, 48000);
    expect(first?.id).toBe('vocals');
    expect(second?.id).toBe('vocals');
    // The clip id is still generated once and kept.
    expect(second?.clips[0].id).toBe(first?.clips[0].id);
  });

  it('follows a config id that changes, over the id remembered for that index', () => {
    const ids = stableIds();
    const base = { src: 'a.opus', name: 'A', duration: 5 };
    const generated = buildTrackFromConfig(base, 0, undefined, ids, 48000);
    const named = buildTrackFromConfig({ ...base, id: 'vocals' }, 0, undefined, ids, 48000);
    const renamed = buildTrackFromConfig({ ...base, id: 'lead' }, 0, undefined, ids, 48000);
    expect(named?.id).toBe('vocals');
    expect(renamed?.id).toBe('lead');
    expect(generated?.id).not.toBe('vocals');
  });
});

describe('an empty config id', () => {
  it('counts as no id: the generated one is used and kept', () => {
    const ids = stableIds();
    const config: AudioTrackConfig = { id: '', src: 'a.opus', name: 'A', duration: 5 };
    const first = buildTrackFromConfig(config, 0, undefined, ids, 48000);
    const second = buildTrackFromConfig(config, 0, undefined, ids, 48000);
    expect(first?.id).not.toBe('');
    expect(second?.id).toBe(first?.id);
    expect(duplicateTrackIds([{ id: '' }, { id: '' }])).toEqual([]);
  });
});

describe('duplicateTrackIds', () => {
  it('lists each config id that is used more than once', () => {
    expect(
      duplicateTrackIds([{ id: 'a' }, { id: 'b' }, { id: 'a' }, {}, {}, { id: 'a' }, { id: 'b' }])
    ).toEqual(['a', 'b']);
  });

  it('is empty when ids are unique or absent', () => {
    expect(duplicateTrackIds([{ id: 'a' }, { id: 'b' }, {}, {}])).toEqual([]);
  });
});
