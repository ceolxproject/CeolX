/**
 * Minimal retry wrapper — executes the thunk once, waits `retryDelayMs` on
 * failure, then attempts once more. Matches M7-T3 R8.6: "1 automatic retry
 * after 3 seconds; log after 2nd failure". For V1 we retry on any error;
 * callers can pass `isRetryable` to filter (e.g., skip retry on permanent
 * `ApiInputError`).
 */
interface RetryOptions {
  retryDelayMs?: number;
  isRetryable?: (err: unknown) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  { retryDelayMs = 3000, isRetryable = () => true }: RetryOptions = {}
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isRetryable(err)) throw err;
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    return await fn();
  }
}
