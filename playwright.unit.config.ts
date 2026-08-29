import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/unit-tests',
  timeout: 10_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: 0,
  reporter: [['list']],
  use: {
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});
