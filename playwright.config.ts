import { defineConfig } from '@playwright/test';
import { config } from './src/config/Config';
import { runPaths } from './src/config/RunPaths';

export default defineConfig({
  testDir: './src/tests',
  timeout: 10 * 60 * 1000,
  expect: { timeout: config.uiTimeout },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  outputDir: runPaths.testResults,
  reporter: [
    ['list'],
    ['html', { outputFolder: runPaths.htmlReport, open: 'never' }],
  ],
  use: {
    baseURL: config.lendenClubUrl,
    headless: config.headless,
    viewport: null,
    launchOptions: {
      slowMo: config.slowMo,
      args: ['--start-maximized'],
    },
    actionTimeout: config.uiTimeout,
    navigationTimeout: config.uiTimeout,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
});
