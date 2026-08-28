import { existsSync } from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import { LendingWorkflowService } from '../services/LendingWorkflowService';

const authStatePath = path.resolve('playwright/.auth/lender.json');

// Reuse a previously authenticated browser state during development.
// If the file is missing, start with an empty state and let the workflow fail with a clear npm run auth message.
test.use({
  storageState: existsSync(authStatePath)
    ? authStatePath
    : { cookies: [], origins: [] },
});

// Sequential by design: this workflow performs real financial actions.
test('execute LenDenClub lending workflow', async ({ page }) => {
  const workflow = new LendingWorkflowService(page);
  await workflow.execute();
});
