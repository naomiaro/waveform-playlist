import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Timer, DEFAULT_TIMER_INTERVAL_MS, _resetTimerWorkerVerdictForTests } from '../core/timer';

/** A stand-in for the browser Worker: records the script and messages, and
 *  lets a test deliver a tick message as the real Worker would. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  static failConstruction = false;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  readonly posted: unknown[] = [];
  terminated = false;
  constructor(readonly url: string) {
    if (FakeWorker.failConstruction) throw new Error('Worker not allowed');
    FakeWorker.instances.push(this);
  }
  postMessage(message: unknown): void {
    this.posted.push(message);
  }
  terminate(): void {
    this.terminated = true;
  }
  /** Deliver one tick from the "worker thread". */
  tick(): void {
    this.onmessage?.({ data: 'tick' });
  }
}

const blobScripts: string[] = [];

function installWorkerGlobals(): void {
  _resetTimerWorkerVerdictForTests();
  FakeWorker.instances = [];
  FakeWorker.failConstruction = false;
  blobScripts.length = 0;
  vi.stubGlobal('Worker', FakeWorker);
  vi.stubGlobal(
    'Blob',
    class {
      constructor(parts: string[]) {
        blobScripts.push(parts.join(''));
      }
    }
  );
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:fake'),
    revokeObjectURL: vi.fn(),
  });
}

describe('Timer (Worker-driven)', () => {
  beforeEach(() => {
    installWorkerGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts a Worker whose script runs a setTimeout loop, and ticks on its messages', () => {
    const onTick = vi.fn();
    const timer = new Timer(onTick);
    timer.start();
    expect(FakeWorker.instances).toHaveLength(1);
    expect(blobScripts[0]).toContain('setTimeout');
    expect(blobScripts[0]).not.toContain('requestAnimationFrame');
    const worker = FakeWorker.instances[0];
    worker.tick();
    worker.tick();
    expect(onTick).toHaveBeenCalledTimes(2);
    timer.dispose();
  });

  it('tells the Worker to start with the interval and to stop, instead of recreating it', () => {
    const timer = new Timer(vi.fn(), { intervalMs: 30 });
    timer.start();
    timer.stop();
    timer.start();
    const worker = FakeWorker.instances[0];
    expect(FakeWorker.instances).toHaveLength(1);
    expect(worker.posted).toEqual([
      { type: 'start', intervalMs: 30 },
      { type: 'stop' },
      { type: 'start', intervalMs: 30 },
    ]);
    timer.dispose();
  });

  it('ignores Worker ticks that arrive after stop', () => {
    const onTick = vi.fn();
    const timer = new Timer(onTick);
    timer.start();
    const worker = FakeWorker.instances[0];
    timer.stop();
    worker.tick(); // in flight when stop was posted
    expect(onTick).not.toHaveBeenCalled();
    timer.dispose();
  });

  it('start is idempotent', () => {
    const timer = new Timer(vi.fn());
    timer.start();
    timer.start();
    expect(FakeWorker.instances[0].posted).toHaveLength(1);
    timer.dispose();
  });

  it('dispose terminates the Worker and revokes the blob URL', () => {
    const timer = new Timer(vi.fn());
    timer.start();
    timer.dispose();
    expect(FakeWorker.instances[0].terminated).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('a tick callback that throws is reported and does not stop later ticks', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onTick = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('tick exploded');
      })
      .mockImplementation(() => {});
    const timer = new Timer(onTick);
    timer.start();
    const worker = FakeWorker.instances[0];
    worker.tick();
    worker.tick();
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('tick exploded'));
    warn.mockRestore();
    timer.dispose();
  });

  it('uses the default interval when none is given', () => {
    const timer = new Timer(vi.fn());
    timer.start();
    expect(FakeWorker.instances[0].posted[0]).toEqual({
      type: 'start',
      intervalMs: DEFAULT_TIMER_INTERVAL_MS,
    });
    expect(DEFAULT_TIMER_INTERVAL_MS).toBeLessThanOrEqual(50); // well inside the 200 ms lookahead
    timer.dispose();
  });
});

describe('Timer (setTimeout fallback)', () => {
  beforeEach(() => {
    _resetTimerWorkerVerdictForTests();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('falls back to a main-thread setTimeout loop when Worker is unavailable', () => {
    vi.stubGlobal('Worker', undefined);
    const onTick = vi.fn();
    const timer = new Timer(onTick, { intervalMs: 25 });
    timer.start();
    vi.advanceTimersByTime(24);
    expect(onTick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTick).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    expect(onTick).toHaveBeenCalledTimes(5);
    timer.dispose();
  });

  it('falls back when constructing the Worker throws (e.g. CSP forbids blob: workers)', () => {
    installWorkerGlobals();
    FakeWorker.failConstruction = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onTick = vi.fn();
    const timer = new Timer(onTick, { intervalMs: 25 });
    timer.start();
    vi.advanceTimersByTime(50);
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('setTimeout'));
    warn.mockRestore();
    timer.dispose();
  });

  it('stop ends the fallback loop and start resumes it', () => {
    vi.stubGlobal('Worker', undefined);
    const onTick = vi.fn();
    const timer = new Timer(onTick, { intervalMs: 25 });
    timer.start();
    vi.advanceTimersByTime(25);
    timer.stop();
    vi.advanceTimersByTime(100);
    expect(onTick).toHaveBeenCalledTimes(1);
    timer.start();
    vi.advanceTimersByTime(25);
    expect(onTick).toHaveBeenCalledTimes(2);
    timer.dispose();
  });

  it('a Worker that fails asynchronously falls back to setTimeout and keeps ticking', () => {
    installWorkerGlobals();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onTick = vi.fn();
    const timer = new Timer(onTick, { intervalMs: 25 });
    timer.start();
    const worker = FakeWorker.instances[0];
    worker.onerror?.({ message: 'blob: worker refused by CSP' });
    expect(worker.terminated).toBe(true);
    vi.advanceTimersByTime(50);
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('setTimeout'));
    warn.mockRestore();
    timer.dispose();
  });

  it('start() after dispose() is a no-op that creates no Worker and no timeout', () => {
    installWorkerGlobals();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onTick = vi.fn();
    const timer = new Timer(onTick, { intervalMs: 25 });
    timer.start();
    timer.dispose();
    timer.start();
    expect(FakeWorker.instances).toHaveLength(1); // no second Worker
    vi.advanceTimersByTime(100);
    expect(onTick).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('disposed'));
    warn.mockRestore();
  });

  it('the fallback does not double its chain when a tick stops and restarts the timer', () => {
    vi.stubGlobal('Worker', undefined);
    const ticks: number[] = [];
    const timer: Timer = new Timer(
      () => {
        ticks.push(Date.now());
        timer.stop();
        timer.start(); // loop-on-end style restart from inside the tick
      },
      { intervalMs: 25 }
    );
    timer.start();
    vi.advanceTimersByTime(100);
    expect(ticks).toHaveLength(4); // 25, 50, 75, 100 — not 7 or 15
    expect(vi.getTimerCount()).toBe(1);
    timer.dispose();
  });

  it('a CSP refusal is probed and warned once per page, not once per Timer', () => {
    installWorkerGlobals();
    FakeWorker.failConstruction = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = new Timer(vi.fn(), { intervalMs: 25 });
    const b = new Timer(vi.fn(), { intervalMs: 25 });
    a.start();
    b.start();
    expect(warn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(25);
    a.dispose();
    b.dispose();
    warn.mockRestore();
  });

  it('a tick that calls stop() schedules nothing further', () => {
    vi.stubGlobal('Worker', undefined);
    const timer = new Timer(() => timer.stop(), { intervalMs: 25 });
    timer.start();
    vi.advanceTimersByTime(25);
    expect(vi.getTimerCount()).toBe(0);
    timer.dispose();
  });
});
