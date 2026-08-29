import { test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { LenderApiClient } from '../api/LenderApiClient';
import { OtpApiClient } from '../api/OtpApiClient';
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
    await page.context().storageState({ path: AUTH_STATE_PATH });
  } finally {
    await lenderApi.completeSession(lenderData.sessionId).catch(() => undefined);
  }
});
