import { describe, it, expect, vi } from 'vitest';
import { syncPeaksForChangedClips } from '../interactions/clip-peak-sync';
import type { ClipPeakSyncHost } from '../interactions/clip-peak-sync';
import type { ClipTrack, PeakData } from '@waveform-playlist/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClip(
  id: string,
  offsetSamples: number,
  durationSamples: number,
  audioBuffer?: AudioBuffer
) {
  return {
    id,
    offsetSamples,
    durationSamples,
    startSample: 0,
    sourceDurationSamples: 96000,
    audioBuffer,
  } as unknown as import('@waveform-playlist/core').AudioClip;
}

function makeTrack(id: string, clips: ReturnType<typeof makeClip>[]): ClipTrack {
  return {
    id,
    clips,
    gain: 1,
    stereoPan: 0,
    muted: false,
    soloed: false,
  } as unknown as ClipTrack;
}

function makePeakData(): PeakData {
  return { data: [new Int16Array(10)], length: 10, bits: 16 };
}

function makeAudioBuffer(): AudioBuffer {
  return { length: 96000, duration: 2, sampleRate: 48000 } as unknown as AudioBuffer;
}

function createMockHost(overrides: Partial<ClipPeakSyncHost> = {}): ClipPeakSyncHost {
  return {
    samplesPerPixel: 1024,
    mono: false,
    _clipBuffers: new Map(),
    _clipOffsets: new Map(),
    _peaksData: new Map(),
    _peakPipeline: {
      generatePeaks: vi.fn().mockResolvedValue(makePeakData()),
      reextractPeaks: vi.fn().mockReturnValue(new Map()),
      terminate: vi.fn(),
    } as any,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncPeaksForChangedClips', () => {
  describe('new clips (split)', () => {
    it('generates peaks for clip IDs not in _peaksData', () => {
      const buf = makeAudioBuffer();
      const clip = makeClip('new-clip', 0, 48000, buf);
      const track = makeTrack('t1', [clip]);
      const host = createMockHost();

      syncPeaksForChangedClips(host, [track]);

      expect(host._peakPipeline.generatePeaks).toHaveBeenCalledWith(buf, 1024, false, 0, 48000);
    });

    it('stores AudioBuffer and offsets for new clips', () => {
      const buf = makeAudioBuffer();
      const clip = makeClip('new-clip', 1000, 40000, buf);
      const track = makeTrack('t1', [clip]);
      const host = createMockHost();

      syncPeaksForChangedClips(host, [track]);

      expect(host._clipBuffers.get('new-clip')).toBe(buf);
      expect(host._clipOffsets.get('new-clip')).toEqual({
        offsetSamples: 1000,
        durationSamples: 40000,
      });
    });
  });

  describe('changed clips (trim)', () => {
    it('regenerates peaks when offsetSamples changes', () => {
      const buf = makeAudioBuffer();
      const clip = makeClip('clip-1', 5000, 40000, buf);
      const track = makeTrack('t1', [clip]);
      const host = createMockHost({
        _peaksData: new Map([['clip-1', makePeakData()]]),
        _clipOffsets: new Map([['clip-1', { offsetSamples: 0, durationSamples: 40000 }]]),
      });

      syncPeaksForChangedClips(host, [track]);

      expect(host._peakPipeline.generatePeaks).toHaveBeenCalledWith(buf, 1024, false, 5000, 40000);
    });

    it('regenerates peaks when durationSamples changes', () => {
      const buf = makeAudioBuffer();
      const clip = makeClip('clip-1', 0, 30000, buf);
      const track = makeTrack('t1', [clip]);
      const host = createMockHost({
        _peaksData: new Map([['clip-1', makePeakData()]]),
        _clipOffsets: new Map([['clip-1', { offsetSamples: 0, durationSamples: 48000 }]]),
      });

      syncPeaksForChangedClips(host, [track]);

      expect(host._peakPipeline.generatePeaks).toHaveBeenCalled();
    });
  });

  describe('unchanged clips', () => {
    it('skips clips with matching peaksData and offsets', () => {
      const clip = makeClip('clip-1', 0, 48000);
      const track = makeTrack('t1', [clip]);
      const host = createMockHost({
        _peaksData: new Map([['clip-1', makePeakData()]]),
        _clipOffsets: new Map([['clip-1', { offsetSamples: 0, durationSamples: 48000 }]]),
      });

      syncPeaksForChangedClips(host, [track]);

      expect(host._peakPipeline.generatePeaks).not.toHaveBeenCalled();
    });
  });

  describe('sibling AudioBuffer lookup', () => {
    it('finds AudioBuffer from sibling clip on same track', () => {
      const buf = makeAudioBuffer();
      // Sibling has the buffer in _clipBuffers, new clip does not
      const siblingClip = makeClip('sibling', 0, 48000);
      const newClip = makeClip('new-clip', 48000, 48000); // no audioBuffer
      const track = makeTrack('t1', [siblingClip, newClip]);
      const host = createMockHost({
        _clipBuffers: new Map([['sibling', buf]]),
        _peaksData: new Map([['sibling', makePeakData()]]),
        _clipOffsets: new Map([['sibling', { offsetSamples: 0, durationSamples: 48000 }]]),
      });

      syncPeaksForChangedClips(host, [track]);

      expect(host._peakPipeline.generatePeaks).toHaveBeenCalledWith(buf, 1024, false, 48000, 48000);
    });
  });

  describe('missing AudioBuffer', () => {
    it('warns and skips when no AudioBuffer available', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const clip = makeClip('no-buffer', 0, 48000); // no audioBuffer
      const track = makeTrack('t1', [clip]);
      const host = createMockHost();

      syncPeaksForChangedClips(host, [track]);

      expect(host._peakPipeline.generatePeaks).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('no AudioBuffer for clip no-buffer')
      );
      warnSpy.mockRestore();
    });
  });

  describe('orphan cleanup', () => {
    it('removes entries for clip IDs no longer in any track', () => {
      const buf = makeAudioBuffer();
      const clip = makeClip('kept', 0, 48000, buf);
      const track = makeTrack('t1', [clip]);
      const host = createMockHost({
        _clipBuffers: new Map([
          ['kept', buf],
          ['orphaned', buf],
        ]),
        _clipOffsets: new Map([
          ['kept', { offsetSamples: 0, durationSamples: 48000 }],
          ['orphaned', { offsetSamples: 0, durationSamples: 48000 }],
        ]),
        _peaksData: new Map([
          ['kept', makePeakData()],
          ['orphaned', makePeakData()],
        ]),
      });

      syncPeaksForChangedClips(host, [track]);

      expect(host._clipBuffers.has('orphaned')).toBe(false);
      expect(host._clipOffsets.has('orphaned')).toBe(false);
      expect(host._peaksData.has('orphaned')).toBe(false);
      // Kept entries remain
      expect(host._clipBuffers.has('kept')).toBe(true);
      expect(host._clipOffsets.has('kept')).toBe(true);
      expect(host._peaksData.has('kept')).toBe(true);
    });

    it('creates new Map references after cleanup for Lit reactivity', () => {
      const buf = makeAudioBuffer();
      const host = createMockHost({
        _clipBuffers: new Map([['orphaned', buf]]),
        _clipOffsets: new Map([['orphaned', { offsetSamples: 0, durationSamples: 48000 }]]),
        _peaksData: new Map([['orphaned', makePeakData()]]),
      });
      const originalBuffers = host._clipBuffers;
      const originalOffsets = host._clipOffsets;
      const originalPeaks = host._peaksData;

      syncPeaksForChangedClips(host, []);

      // All Maps should be new references (not same object)
      expect(host._clipBuffers).not.toBe(originalBuffers);
      expect(host._clipOffsets).not.toBe(originalOffsets);
      expect(host._peaksData).not.toBe(originalPeaks);
    });

    it('does not create new Map references when no orphans exist', () => {
      const buf = makeAudioBuffer();
      const clip = makeClip('clip-1', 0, 48000, buf);
      const track = makeTrack('t1', [clip]);
      const host = createMockHost({
        _clipBuffers: new Map([['clip-1', buf]]),
        _clipOffsets: new Map([['clip-1', { offsetSamples: 0, durationSamples: 48000 }]]),
        _peaksData: new Map([['clip-1', makePeakData()]]),
      });
      const originalBuffers = host._clipBuffers;
      const originalPeaks = host._peaksData;

      syncPeaksForChangedClips(host, [track]);

      // No orphans — Maps should keep same reference
      expect(host._clipBuffers).toBe(originalBuffers);
      expect(host._peaksData).toBe(originalPeaks);
    });
  });
});
