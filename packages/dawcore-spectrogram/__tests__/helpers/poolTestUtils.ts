import { vi } from 'vitest';

/** Minimal native-Worker stand-in for pool tests. */
export function createMockNativeWorker(): Worker {
  const worker = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null as ((e: MessageEvent) => void) | null,
    onerror: null as ((e: ErrorEvent) => void) | null,
  };
  return worker as unknown as Worker;
}

/** Deliver a message to a mock worker as if the worker thread had posted it. */
export function respondToWorker(worker: unknown, data: Record<string, unknown>): void {
  const w = worker as { onmessage: ((e: { data: unknown }) => void) | null };
  w.onmessage?.({ data } as MessageEvent);
}

/** All messages posted INTO a mock worker, in order. */
export function postedMessages(worker: unknown): Array<Record<string, unknown>> {
  return (worker as { postMessage: ReturnType<typeof vi.fn> }).postMessage.mock.calls.map(
    (c: unknown[]) => c[0] as Record<string, unknown>
  );
}

/** Acknowledge every pending compute-fft on a mock worker with a cache-key response. */
export function ackComputeFFTs(worker: unknown, cacheKey = 'k'): void {
  for (const msg of postedMessages(worker)) {
    if (msg.type === 'compute-fft') {
      respondToWorker(worker, { id: msg.id, type: 'cache-key', cacheKey });
    }
  }
}

/** Factory that records every worker it creates. */
export function trackingWorkerFactory(): { factory: () => Worker; workers: Worker[] } {
  const workers: Worker[] = [];
  const factory = () => {
    const w = createMockNativeWorker();
    workers.push(w);
    return w;
  };
  return { factory, workers };
}
