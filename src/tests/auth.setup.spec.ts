import { test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { LenderApiClient } from '../api/LenderApiClient';
import { OtpApiClient } from '../api/OtpApiClient';
import { LoginService } from '../services/LoginService';

export const AUTH_STATE_PATH = path.resolve('playwright/.auth/lender.json');

test('authenticate and save LenDenClub session', async ({ page }) => {
  const lenderData = await new LenderApiClient().getLenderData();

  await new LoginService(new OtpApiClient()).login(
    page,
    lenderData.lender.mobileNumber,
    lenderData.sessionId,
  );

  await mkdir(path.dirname(AUTH_STATE_PATH), { recursive: true });
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
