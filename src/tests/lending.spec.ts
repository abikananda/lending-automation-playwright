import { existsSync } from 'node:fs';
import { test } from '@playwright/test';
import { config } from '../config/Config';
import { runPaths } from '../config/RunPaths';
import { AuthSessionVerifier } from '../services/AuthSessionVerifier';
import { LendingWorkflowService } from '../services/LendingWorkflowService';

const authStatePath = runPaths.authState;

// Each username owns a separate browser storage state, allowing independent parallel processes.
// If the file is missing, start empty and let the auth verifier fail with a username-specific auth command.
test.use({
  storageState: existsSync(authStatePath)
    ? authStatePath
    : { cookies: [], origins: [] },
});

// Sequential inside one process by design; separate username processes may run in parallel.
test(`execute LenDenClub lending workflow for ${config.username}`, async ({ page }) => {
  // Verify the saved browser session before the workflow creates a backend lending session
  // or reaches any financial browser action.
  await new AuthSessionVerifier().assertReusable(page);

  const workflow = new LendingWorkflowService(page);
  await workflow.execute();
});
