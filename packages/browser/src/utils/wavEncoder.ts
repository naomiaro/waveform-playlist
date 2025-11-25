/**
 * WAV file encoder
 * Converts AudioBuffer to WAV format Blob
 */

export interface WavEncoderOptions {
  /** Bit depth: 16 or 32. Default: 16 */
  bitDepth?: 16 | 32;
}

/**
 * Encode an AudioBuffer to WAV format
 * @param audioBuffer - The AudioBuffer to encode
 * @param options - Encoding options
 * @returns WAV file as Blob
 */
export function encodeWav(
  audioBuffer: AudioBuffer,
  options: WavEncoderOptions = {}
): Blob {
  const { bitDepth = 16 } = options;

  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numSamples = audioBuffer.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;

  // WAV header is 44 bytes
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // Write WAV header
  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true); // File size minus RIFF header
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true); // AudioFormat (1=PCM, 3=IEEE float)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write interleaved audio data
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(audioBuffer.getChannelData(ch));
  }

  let offset = headerSize;

  if (bitDepth === 16) {
    // 16-bit PCM
    for (let i = 0; i < numSamples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = channelData[ch][i];
        // Clamp to [-1, 1] and convert to 16-bit signed integer
        const clampedSample = Math.max(-1, Math.min(1, sample));
        const intSample = clampedSample < 0
          ? clampedSample * 0x8000
          : clampedSample * 0x7FFF;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }
  } else {
    // 32-bit IEEE float
    for (let i = 0; i < numSamples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        view.setFloat32(offset, channelData[ch][i], true);
        offset += 4;
      }
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Write a string to a DataView at the specified offset
 */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Trigger a download of a Blob with the specified filename
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
