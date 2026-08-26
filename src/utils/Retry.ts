import { logger } from './Logger';

export async function retryTransient<T>(
  operation: () => Promise<T>,
  attempts = 3,
  delaysMs = [500, 1000, 2000],
  shouldRetry: (error: unknown) => boolean = () => true,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error)) {
        logger.warn('Operation failed with a non-retryable error; retry skipped');
        throw error;
      }

      if (attempt === attempts) break;
      const delay = delaysMs[attempt - 1] ?? delaysMs[delaysMs.length - 1] ?? 1000;
      logger.warn(`Transient operation failed; retry ${attempt + 1}/${attempts} in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
