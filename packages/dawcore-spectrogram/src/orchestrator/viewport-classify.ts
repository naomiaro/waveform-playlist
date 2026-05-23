export interface CanvasMeta {
  canvasId: string;
  globalPixelOffset: number;
  widthPx: number;
}

export interface ViewportBounds {
  visibleStartPx: number;
  visibleEndPx: number;
  bufferStartPx: number;
  bufferEndPx: number;
}

export interface ClassifiedTiers<T extends CanvasMeta> {
  viewport: T[];
  buffer: T[];
  remaining: T[];
}

function intersects(a0: number, a1: number, b0: number, b1: number): boolean {
  return a1 > b0 && a0 < b1;
}

export function classifyViewport<T extends CanvasMeta>(
  canvases: T[],
  bounds: ViewportBounds
): ClassifiedTiers<T> {
  const viewport: T[] = [];
  const buffer: T[] = [];
  const remaining: T[] = [];

  for (const c of canvases) {
    const start = c.globalPixelOffset;
    const end = c.globalPixelOffset + c.widthPx;

    if (intersects(start, end, bounds.visibleStartPx, bounds.visibleEndPx)) {
      viewport.push(c);
    } else if (intersects(start, end, bounds.bufferStartPx, bounds.bufferEndPx)) {
      buffer.push(c);
    } else {
      remaining.push(c);
    }
  }

  return { viewport, buffer, remaining };
}
