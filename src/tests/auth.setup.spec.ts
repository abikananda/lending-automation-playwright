import { test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LenderApiClient } from '../api/LenderApiClient';
import { OtpApiClient } from '../api/OtpApiClient';
import { config } from '../config/Config';
import { runPaths } from '../config/RunPaths';
import { LoginService } from '../services/LoginService';

export const AUTH_STATE_PATH = runPaths.authState;

test('authenticate and save LenDenClub session', async ({ page }) => {
  const lenderApi = new LenderApiClient();
  const lenderData = await lenderApi.getLenderData();

  try {
    await new LoginService(new OtpApiClient()).login(
      page,
      lenderData.lender.mobileNumber,
      lenderData.sessionId,
    );

    await mkdir(path.dirname(AUTH_STATE_PATH), { recursive: true });

    // Playwright storageState persists cookies/localStorage and, when requested,
    // IndexedDB. sessionStorage is not part of storageState, so persist it separately.
    await page.context().storageState({ path: AUTH_STATE_PATH, indexedDB: true });

    const sessionStorageEntries = await page.evaluate(() =>
      Object.fromEntries(
        Array.from({ length: window.sessionStorage.length }, (_, index) => {
          const key = window.sessionStorage.key(index);
          return key === null ? null : [key, window.sessionStorage.getItem(key) ?? ''];
        }).filter((entry): entry is [string, string] => entry !== null),
      ),
    );

    await writeFile(
      runPaths.authSessionStorage,
      JSON.stringify(
        {
          origin: new URL(config.lendenClubUrl).origin,
          entries: sessionStorageEntries,
        },
        null,
        2,
      ),
      'utf8',
    );
  } finally {
    await lenderApi.completeSession(lenderData.sessionId).catch(() => undefined);
  }
});
