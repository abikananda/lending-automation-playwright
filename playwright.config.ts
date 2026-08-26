import { defineConfig } from '@playwright/test';
import { config } from './src/config/Config';

export default defineConfig({
  testDir: './src/tests',
  timeout: config.uiTimeout * 4,
  expect: { timeout: config.uiTimeout },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: config.lendenClubUrl,
    headless: config.headless,
    launchOptions: { slowMo: config.slowMo },
    actionTimeout: config.uiTimeout,
    navigationTimeout: config.uiTimeout,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
});
