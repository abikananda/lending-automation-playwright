import { existsSync } from 'node:fs';
import { test } from '@playwright/test';
import { config } from '../config/Config';
import { runPaths } from '../config/RunPaths';
import { LendingWorkflowService } from '../services/LendingWorkflowService';

const authStatePath = runPaths.authState;

// Each username owns a separate browser storage state, allowing independent parallel processes.
// If the file is missing, start empty and let the workflow fail with a username-specific auth command.
test.use({
  storageState: existsSync(authStatePath)
    ? authStatePath
    : { cookies: [], origins: [] },
});

// Sequential inside one process by design; separate username processes may run in parallel.
test(`execute LenDenClub lending workflow for ${config.username}`, async ({ page }) => {
  const workflow = new LendingWorkflowService(page);
  await workflow.execute();
});
