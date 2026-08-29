import { expect, test } from '@playwright/test';
import { retryTransient } from '../utils/Retry';

test.describe('retryTransient', () => {
  test('returns immediately when the operation succeeds', async () => {
    let calls = 0;

    const result = await retryTransient(
      async () => {
        calls += 1;
        return 'ok';
      },
      3,
      [0, 0],
    );

    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  test('retries retryable failures up to the configured attempt count', async () => {
    let calls = 0;

    const result = await retryTransient(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error('temporary');
        return 'recovered';
      },
      3,
      [0, 0],
      () => true,
    );

    expect(result).toBe('recovered');
    expect(calls).toBe(3);
  });

  test('does not retry when shouldRetry rejects the error', async () => {
    let calls = 0;
    const failure = new Error('do not retry');

    await expect(
      retryTransient(
        async () => {
          calls += 1;
          throw failure;
        },
        3,
        [0, 0],
        () => false,
      ),
    ).rejects.toThrow('do not retry');

    expect(calls).toBe(1);
  });

  test('throws the final failure after exhausting retry attempts', async () => {
    let calls = 0;

    await expect(
      retryTransient(
        async () => {
          calls += 1;
          throw new Error(`failure-${calls}`);
        },
        3,
        [0, 0],
        () => true,
      ),
    ).rejects.toThrow('failure-3');

    expect(calls).toBe(3);
  });
});
