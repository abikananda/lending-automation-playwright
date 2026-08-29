import path from 'node:path';
import { config } from './Config';

function safeUsername(): string {
  return config.username.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export const runPaths = {
  authState: path.resolve('playwright/.auth', `${safeUsername()}.json`),
  testResults: path.resolve('test-results', safeUsername()),
  htmlReport: path.resolve('playwright-report', safeUsername()),
} as const;
