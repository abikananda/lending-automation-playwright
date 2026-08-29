import path from 'node:path';
import { config } from './Config';

function safeLenderId(): string {
  return config.lenderId.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export const runPaths = {
  authState: path.resolve('playwright/.auth', `${safeLenderId()}.json`),
  testResults: path.resolve('test-results', safeLenderId()),
  htmlReport: path.resolve('playwright-report', safeLenderId()),
} as const;
