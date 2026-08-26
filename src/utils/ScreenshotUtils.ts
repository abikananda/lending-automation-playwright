import type { Page } from '@playwright/test';
import { logger } from './Logger';

export async function captureFailure(page: Page, name: string): Promise<void> {
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  try {
    await page.screenshot({ path: `test-results/${safeName}.png`, fullPage: true });
  } catch (error) {
    logger.warn(`Could not capture screenshot: ${error instanceof Error ? error.message : String(error)}`);
  }
  logger.error(`Failure URL: ${page.url()}`);
}
