import { formatTime } from './time-format';

const timeinfo = new Map([
  [700, { marker: 1000, bigStep: 500, smallStep: 100 }],
  [1500, { marker: 2000, bigStep: 1000, smallStep: 200 }],
  [2500, { marker: 2000, bigStep: 1000, smallStep: 500 }],
  [5000, { marker: 5000, bigStep: 1000, smallStep: 500 }],
  [10000, { marker: 10000, bigStep: 5000, smallStep: 1000 }],
  [12000, { marker: 15000, bigStep: 5000, smallStep: 1000 }],
  [Infinity, { marker: 30000, bigStep: 10000, smallStep: 5000 }],
]);

export function getScaleInfo(samplesPerPixel: number) {
  for (const [resolution, config] of timeinfo) {
    if (samplesPerPixel < resolution) {
      return config;
    }
  }
  return { marker: 30000, bigStep: 10000, smallStep: 5000 };
}

export interface TickData {
  /** Map of pixel position → tick height */
  canvasInfo: Map<number, number>;
  /** Labeled ticks with pixel positions */
  labels: Array<{ pix: number; text: string }>;
  /** Total width in pixels */
  widthX: number;
}

/**
 * Compute temporal tick data for a ruler.
 *
 * Pure function — no DOM, no React.
 */
export function computeTemporalTicks(
  samplesPerPixel: number,
  sampleRate: number,
  duration: number,
  rulerHeight: number
): TickData {
  const widthX = Math.ceil((duration * sampleRate) / samplesPerPixel);
  const config = getScaleInfo(samplesPerPixel);
  const { marker, bigStep, smallStep } = config;
  const canvasInfo = new Map<number, number>();
  const labels: Array<{ pix: number; text: string }> = [];
  const pixPerSec = sampleRate / samplesPerPixel;

  let counter = 0;
  for (let i = 0; i < widthX; i += (pixPerSec * smallStep) / 1000) {
    const pix = Math.floor(i);

    if (counter % marker === 0) {
      canvasInfo.set(pix, rulerHeight);
      labels.push({ pix, text: formatTime(counter) });
    } else if (counter % bigStep === 0) {
      canvasInfo.set(pix, Math.floor(rulerHeight / 2));
    } else if (counter % smallStep === 0) {
      canvasInfo.set(pix, Math.floor(rulerHeight / 5));
    }

    counter += smallStep;
  }

  return { widthX, canvasInfo, labels };
}
