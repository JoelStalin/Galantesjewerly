export type TimeoutFallbackResult<T> = {
  value: T;
  timedOut: boolean;
};

export async function withTimeoutFallback<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<TimeoutFallbackResult<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<TimeoutFallbackResult<T>>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({ value: fallback, timedOut: true });
    }, timeoutMs);
  });

  const valuePromise = promise
    .then((value) => ({ value, timedOut: false }))
    .catch(() => ({ value: fallback, timedOut: false }));

  const result = await Promise.race([valuePromise, timeoutPromise]);

  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  return result;
}
