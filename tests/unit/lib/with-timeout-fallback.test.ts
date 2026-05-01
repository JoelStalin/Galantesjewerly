import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTimeoutFallback } from '@/lib/with-timeout-fallback';

describe('withTimeoutFallback', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the resolved value before the timeout', async () => {
    const result = await withTimeoutFallback(Promise.resolve('ok'), 1000, 'fallback');

    expect(result).toEqual({ value: 'ok', timedOut: false });
  });

  it('returns the fallback when the promise stalls', async () => {
    vi.useFakeTimers();

    const resultPromise = withTimeoutFallback(new Promise<string>(() => {}), 1000, 'fallback');
    await vi.advanceTimersByTimeAsync(1000);

    await expect(resultPromise).resolves.toEqual({ value: 'fallback', timedOut: true });
  });

  it('returns the fallback when the promise rejects', async () => {
    const result = await withTimeoutFallback(Promise.reject(new Error('boom')), 1000, 'fallback');

    expect(result).toEqual({ value: 'fallback', timedOut: false });
  });
});
