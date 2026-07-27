import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildTrackFromConfig } from '../buildTrackFromConfig';
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
});
