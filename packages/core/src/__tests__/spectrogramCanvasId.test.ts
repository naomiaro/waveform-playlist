import { describe, it, expect } from 'vitest';
import {
  buildSpectrogramCanvasId,
  parseSpectrogramCanvasId,
  type SpectrogramCanvasIdParts,
} from '../spectrogramCanvasId';

describe('buildSpectrogramCanvasId', () => {
  it('formats as ${clipId}-ch${channelIndex}-chunk${chunkIndex}', () => {
    expect(buildSpectrogramCanvasId({ clipId: 'myclip', channelIndex: 0, chunkIndex: 5 })).toBe(
      'myclip-ch0-chunk5'
    );
    expect(buildSpectrogramCanvasId({ clipId: 'clip', channelIndex: 2, chunkIndex: 10 })).toBe(
      'clip-ch2-chunk10'
    );
  });

  it('keeps hyphens in the clip id', () => {
    expect(buildSpectrogramCanvasId({ clipId: 'a-b-c', channelIndex: 1, chunkIndex: 0 })).toBe(
      'a-b-c-ch1-chunk0'
    );
  });
});

describe('parseSpectrogramCanvasId', () => {
  it('parses clip id, channel index, and chunk index', () => {
    expect(parseSpectrogramCanvasId('myclip-ch0-chunk5')).toEqual({
      clipId: 'myclip',
      channelIndex: 0,
      chunkIndex: 5,
    });
    expect(parseSpectrogramCanvasId('clip-ch2-chunk10')).toEqual({
      clipId: 'clip',
      channelIndex: 2,
      chunkIndex: 10,
    });
  });

  it('keeps hyphens in the clip id (greedy match, anchored to trailing segment)', () => {
    expect(parseSpectrogramCanvasId('a-b-c-ch1-chunk0')).toEqual({
      clipId: 'a-b-c',
      channelIndex: 1,
      chunkIndex: 0,
    });
  });

  it('anchors to the LAST -ch{N}-chunk{M} when the clip id itself contains one', () => {
    expect(parseSpectrogramCanvasId('a-ch9-chunk9-ch1-chunk2')).toEqual({
      clipId: 'a-ch9-chunk9',
      channelIndex: 1,
      chunkIndex: 2,
    });
  });

  it('returns null when the id does not match', () => {
    expect(parseSpectrogramCanvasId('bad')).toBeNull();
    expect(parseSpectrogramCanvasId('clip-ch0')).toBeNull();
    expect(parseSpectrogramCanvasId('clip-chunk0')).toBeNull();
    expect(parseSpectrogramCanvasId('chunk0')).toBeNull();
  });
});

describe('build ∘ parse roundtrip', () => {
  const cases: SpectrogramCanvasIdParts[] = [
    { clipId: 'clip', channelIndex: 0, chunkIndex: 0 },
    { clipId: 'my-clip', channelIndex: 1, chunkIndex: 42 },
    { clipId: 'a-b-c', channelIndex: 3, chunkIndex: 7 },
    // clip id that itself looks like a canvas id — must still roundtrip
    { clipId: 'a-ch9-chunk9', channelIndex: 1, chunkIndex: 2 },
  ];
  it('parse(build(parts)) deep-equals parts', () => {
    for (const parts of cases) {
      expect(parseSpectrogramCanvasId(buildSpectrogramCanvasId(parts))).toEqual(parts);
    }
  });
});
