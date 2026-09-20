import { expect, test } from '@playwright/test';
import { buildBackendHeaders } from '../api/BackendHeaders';

test('adds the configured backend API key header', () => {
  const headers = buildBackendHeaders('test-api-key', 'X-API-Key');

  expect(headers).toEqual({
    Accept: '*/*',
    'Content-Type': 'application/json',
    'X-API-Key': 'test-api-key',
  });
});

test('supports a custom authentication header', () => {
  const headers = buildBackendHeaders('test-api-key', 'X-Custom-Key');
  expect(headers['X-Custom-Key']).toBe('test-api-key');
});

test('rejects missing credentials instead of making unauthorized requests', () => {
  expect(() => buildBackendHeaders(' ', 'X-API-Key')).toThrow(
    'BACKEND_API_KEY must not be blank',
  );
  expect(() => buildBackendHeaders('test-api-key', ' ')).toThrow(
    'BACKEND_AUTH_HEADER must not be blank',
  );
});
