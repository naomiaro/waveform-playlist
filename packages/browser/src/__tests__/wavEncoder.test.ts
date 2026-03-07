import { describe, it, expect } from 'vitest';
import { encodeWav } from '../utils/wavEncoder';

/**
 * Creates a mock AudioBuffer with the given channel data.
 */
function createMockAudioBuffer(channelData: Float32Array[], sampleRate = 44100): AudioBuffer {
  const length = channelData[0]?.length ?? 0;
  return {
    numberOfChannels: channelData.length,
    sampleRate,
    length,
    duration: length / sampleRate,
    getChannelData(channel: number): Float32Array {
      return channelData[channel];
    },
  } as unknown as AudioBuffer;
}

/**
 * Reads a string from a DataView at the given offset.
 */
function readString(view: DataView, offset: number, length: number): string {
  let str = '';
  for (let i = 0; i < length; i++) {
    str += String.fromCharCode(view.getUint8(offset + i));
  }
  return str;
}

describe('encodeWav', () => {
  describe('WAV header', () => {
    it('writes correct RIFF marker', async () => {
      const buf = createMockAudioBuffer([new Float32Array([0])]);
      const blob = encodeWav(buf);
      const arrayBuffer = await blob.arrayBuffer();
      const view = new DataView(arrayBuffer);

      expect(readString(view, 0, 4)).toBe('RIFF');
    });

    it('writes correct WAVE marker', async () => {
      const buf = createMockAudioBuffer([new Float32Array([0])]);
      const blob = encodeWav(buf);
      const arrayBuffer = await blob.arrayBuffer();
      const view = new DataView(arrayBuffer);

      expect(readString(view, 8, 4)).toBe('WAVE');
    });

    it('writes correct fmt chunk marker and size', async () => {
      const buf = createMockAudioBuffer([new Float32Array([0])]);
      const blob = encodeWav(buf);
      const arrayBuffer = await blob.arrayBuffer();
      const view = new DataView(arrayBuffer);

      expect(readString(view, 12, 4)).toBe('fmt ');
      // PCM fmt chunk size is always 16
      expect(view.getUint32(16, true)).toBe(16);
    });

    it('writes correct data chunk marker', async () => {
      const buf = createMockAudioBuffer([new Float32Array([0])]);
      const blob = encodeWav(buf);
      const arrayBuffer = await blob.arrayBuffer();
      const view = new DataView(arrayBuffer);

      expect(readString(view, 36, 4)).toBe('data');
    });

    it('sets AudioFormat to 1 (PCM) for 16-bit', async () => {
      const buf = createMockAudioBuffer([new Float32Array([0])]);
      const blob = encodeWav(buf, { bitDepth: 16 });
      const arrayBuffer = await blob.arrayBuffer();
      const view = new DataView(arrayBuffer);

      expect(view.getUint16(20, true)).toBe(1);
    });

    it('sets AudioFormat to 3 (IEEE float) for 32-bit', async () => {
      const buf = createMockAudioBuffer([new Float32Array([0])]);
      const blob = encodeWav(buf, { bitDepth: 32 });
      const arrayBuffer = await blob.arrayBuffer();
      const view = new DataView(arrayBuffer);

      expect(view.getUint16(20, true)).toBe(3);
    });

    it('writes correct number of channels', async () => {
      const stereo = createMockAudioBuffer([new Float32Array([0]), new Float32Array([0])]);
      const blob = encodeWav(stereo);
      const arrayBuffer = await blob.arrayBuffer();
      const view = new DataView(arrayBuffer);

      expect(view.getUint16(22, true)).toBe(2);
    });

    it('writes correct sample rate', async () => {
      const buf = createMockAudioBuffer([new Float32Array([0])], 48000);
      const blob = encodeWav(buf);
      const arrayBuffer = await blob.arrayBuffer();
      const view = new DataView(arrayBuffer);

      expect(view.getUint32(24, true)).toBe(48000);
    });

    it('writes correct byte rate for 16-bit mono', async () => {
      const buf = createMockAudioBuffer([new Float32Array([0])], 44100);
      const blob = encodeWav(buf, { bitDepth: 16 });
      const arrayBuffer = await blob.arrayBuffer();
      const view = new DataView(arrayBuffer);

      // byteRate = sampleRate * numChannels * bytesPerSample = 44100 * 1 * 2
      expect(view.getUint32(28, true)).toBe(88200);
    });

    it('writes correct block align for stereo 16-bit', async () => {
      const stereo = createMockAudioBuffer([new Float32Array([0]), new Float32Array([0])]);
      const blob = encodeWav(stereo, { bitDepth: 16 });
      const arrayBuffer = await blob.arrayBuffer();
      const view = new DataView(arrayBuffer);

      // blockAlign = numChannels * bytesPerSample = 2 * 2
      expect(view.getUint16(32, true)).toBe(4);
    });

    it('writes correct bits per sample', async () => {
      const buf = createMockAudioBuffer([new Float32Array([0])]);

      const blob16 = encodeWav(buf, { bitDepth: 16 });
      const view16 = new DataView(await blob16.arrayBuffer());
      expect(view16.getUint16(34, true)).toBe(16);

      const blob32 = encodeWav(buf, { bitDepth: 32 });
      const view32 = new DataView(await blob32.arrayBuffer());
      expect(view32.getUint16(34, true)).toBe(32);
    });
  });

  describe('file size calculations', () => {
    it('RIFF chunk size equals total size minus 8', async () => {
      const samples = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      const buf = createMockAudioBuffer([samples]);
      const blob = encodeWav(buf);
      const arrayBuffer = await blob.arrayBuffer();
      const view = new DataView(arrayBuffer);

      expect(view.getUint32(4, true)).toBe(arrayBuffer.byteLength - 8);
    });

    it('data chunk size matches expected for 16-bit mono', async () => {
      const samples = new Float32Array(10);
      const buf = createMockAudioBuffer([samples]);
      const blob = encodeWav(buf, { bitDepth: 16 });
      const arrayBuffer = await blob.arrayBuffer();
      const view = new DataView(arrayBuffer);

      // dataSize = numSamples * numChannels * bytesPerSample = 10 * 1 * 2
      expect(view.getUint32(40, true)).toBe(20);
    });

    it('data chunk size matches expected for 32-bit stereo', async () => {
      const samples = new Float32Array(8);
      const buf = createMockAudioBuffer([samples, new Float32Array(8)]);
      const blob = encodeWav(buf, { bitDepth: 32 });
      const arrayBuffer = await blob.arrayBuffer();
      const view = new DataView(arrayBuffer);

      // dataSize = numSamples * numChannels * bytesPerSample = 8 * 2 * 4
      expect(view.getUint32(40, true)).toBe(64);
    });

    it('total blob size equals header (44) + data size', async () => {
      const numSamples = 100;
      const buf = createMockAudioBuffer([new Float32Array(numSamples)]);

      const blob16 = encodeWav(buf, { bitDepth: 16 });
      expect(blob16.size).toBe(44 + numSamples * 1 * 2);

      const blob32 = encodeWav(buf, { bitDepth: 32 });
      expect(blob32.size).toBe(44 + numSamples * 1 * 4);
    });
  });

  describe('16-bit PCM encoding', () => {
    it('encodes silence as zeros', async () => {
      const buf = createMockAudioBuffer([new Float32Array(4)]);
      const blob = encodeWav(buf, { bitDepth: 16 });
      const view = new DataView(await blob.arrayBuffer());

      for (let i = 0; i < 4; i++) {
        expect(view.getInt16(44 + i * 2, true)).toBe(0);
      }
    });

    it('encodes positive samples correctly', async () => {
      // +1.0 should map to 0x7FFF (32767)
      const buf = createMockAudioBuffer([new Float32Array([1.0])]);
      const blob = encodeWav(buf, { bitDepth: 16 });
      const view = new DataView(await blob.arrayBuffer());

      expect(view.getInt16(44, true)).toBe(0x7fff);
    });

    it('encodes negative samples correctly', async () => {
      // -1.0 should map to -0x8000 (-32768)
      const buf = createMockAudioBuffer([new Float32Array([-1.0])]);
      const blob = encodeWav(buf, { bitDepth: 16 });
      const view = new DataView(await blob.arrayBuffer());

      expect(view.getInt16(44, true)).toBe(-0x8000);
    });

    it('clamps samples above 1.0', async () => {
      const buf = createMockAudioBuffer([new Float32Array([2.5])]);
      const blob = encodeWav(buf, { bitDepth: 16 });
      const view = new DataView(await blob.arrayBuffer());

      // Should be clamped to 1.0 → 0x7FFF
      expect(view.getInt16(44, true)).toBe(0x7fff);
    });

    it('clamps samples below -1.0', async () => {
      const buf = createMockAudioBuffer([new Float32Array([-3.0])]);
      const blob = encodeWav(buf, { bitDepth: 16 });
      const view = new DataView(await blob.arrayBuffer());

      // Should be clamped to -1.0 → -0x8000
      expect(view.getInt16(44, true)).toBe(-0x8000);
    });

    it('uses little-endian byte order', async () => {
      const buf = createMockAudioBuffer([new Float32Array([1.0])]);
      const blob = encodeWav(buf, { bitDepth: 16 });
      const view = new DataView(await blob.arrayBuffer());

      // 0x7FFF in little-endian: low byte first
      expect(view.getUint8(44)).toBe(0xff);
      expect(view.getUint8(45)).toBe(0x7f);
    });
  });

  describe('32-bit float encoding', () => {
    it('encodes samples as IEEE 754 float', async () => {
      const value = 0.5;
      const buf = createMockAudioBuffer([new Float32Array([value])]);
      const blob = encodeWav(buf, { bitDepth: 32 });
      const view = new DataView(await blob.arrayBuffer());

      expect(view.getFloat32(44, true)).toBeCloseTo(value, 6);
    });

    it('preserves values outside [-1, 1] range (no clamping)', async () => {
      const buf = createMockAudioBuffer([new Float32Array([2.5, -3.0])]);
      const blob = encodeWav(buf, { bitDepth: 32 });
      const view = new DataView(await blob.arrayBuffer());

      expect(view.getFloat32(44, true)).toBeCloseTo(2.5, 6);
      expect(view.getFloat32(48, true)).toBeCloseTo(-3.0, 6);
    });

    it('encodes silence as zero', async () => {
      const buf = createMockAudioBuffer([new Float32Array([0.0])]);
      const blob = encodeWav(buf, { bitDepth: 32 });
      const view = new DataView(await blob.arrayBuffer());

      expect(view.getFloat32(44, true)).toBe(0.0);
    });
  });

  describe('multi-channel interleaving', () => {
    it('interleaves stereo 16-bit samples correctly', async () => {
      const left = new Float32Array([0.5, -0.5]);
      const right = new Float32Array([0.25, -0.25]);
      const buf = createMockAudioBuffer([left, right]);
      const blob = encodeWav(buf, { bitDepth: 16 });
      const view = new DataView(await blob.arrayBuffer());

      // Sample 0: L then R
      const l0 = view.getInt16(44, true);
      const r0 = view.getInt16(46, true);
      // Sample 1: L then R
      const l1 = view.getInt16(48, true);
      const r1 = view.getInt16(50, true);

      // 0.5 * 0x7FFF ≈ 16383
      expect(l0).toBe(Math.floor(0.5 * 0x7fff));
      // 0.25 * 0x7FFF ≈ 8191
      expect(r0).toBe(Math.floor(0.25 * 0x7fff));
      // -0.5 * 0x8000 = -16384
      expect(l1).toBe(Math.floor(-0.5 * 0x8000));
      // -0.25 * 0x8000 = -8192
      expect(r1).toBe(Math.floor(-0.25 * 0x8000));
    });

    it('interleaves stereo 32-bit float samples correctly', async () => {
      const left = new Float32Array([0.1, 0.3]);
      const right = new Float32Array([0.2, 0.4]);
      const buf = createMockAudioBuffer([left, right]);
      const blob = encodeWav(buf, { bitDepth: 32 });
      const view = new DataView(await blob.arrayBuffer());

      // Sample 0: L then R
      expect(view.getFloat32(44, true)).toBeCloseTo(0.1, 6);
      expect(view.getFloat32(48, true)).toBeCloseTo(0.2, 6);
      // Sample 1: L then R
      expect(view.getFloat32(52, true)).toBeCloseTo(0.3, 6);
      expect(view.getFloat32(56, true)).toBeCloseTo(0.4, 6);
    });
  });

  describe('mono encoding', () => {
    it('produces correct output for mono 16-bit', async () => {
      const samples = new Float32Array([0.0, 0.5, -0.5, 1.0, -1.0]);
      const buf = createMockAudioBuffer([samples]);
      const blob = encodeWav(buf, { bitDepth: 16 });

      expect(blob.size).toBe(44 + 5 * 2);
      expect(blob.type).toBe('audio/wav');
    });
  });

  describe('stereo encoding', () => {
    it('produces correct output size for stereo 16-bit', async () => {
      const numSamples = 10;
      const buf = createMockAudioBuffer([
        new Float32Array(numSamples),
        new Float32Array(numSamples),
      ]);
      const blob = encodeWav(buf, { bitDepth: 16 });

      // 44 header + 10 samples * 2 channels * 2 bytes
      expect(blob.size).toBe(44 + 40);
    });
  });

  describe('defaults', () => {
    it('defaults to 16-bit when no options provided', async () => {
      const buf = createMockAudioBuffer([new Float32Array([1.0])]);
      const blob = encodeWav(buf);
      const view = new DataView(await blob.arrayBuffer());

      // AudioFormat should be 1 (PCM), not 3 (float)
      expect(view.getUint16(20, true)).toBe(1);
      expect(view.getUint16(34, true)).toBe(16);
    });

    it('returns a Blob with audio/wav MIME type', () => {
      const buf = createMockAudioBuffer([new Float32Array([0])]);
      const blob = encodeWav(buf);

      expect(blob.type).toBe('audio/wav');
    });
  });
});
