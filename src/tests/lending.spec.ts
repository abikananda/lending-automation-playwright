import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { test } from '@playwright/test';
import { config } from '../config/Config';
import { runPaths } from '../config/RunPaths';
import { AuthSessionVerifier } from '../services/AuthSessionVerifier';
import { LendingWorkflowService } from '../services/LendingWorkflowService';

const authStatePath = runPaths.authState;

// The workflow has its own 15-minute budget per lending rule. Keep the test-level
// timeout comfortably above that so multiple configured rules can complete and finalize.
test.setTimeout(60 * 60 * 1000);

// Each username owns a separate browser storage state, allowing independent parallel processes.
// If the file is missing, start empty and let the auth verifier fail with a username-specific auth command.
test.use({
  storageState: existsSync(authStatePath)
    ? authStatePath
    : { cookies: [], origins: [] },
});

test.beforeEach(async ({ context }) => {
  if (!existsSync(runPaths.authSessionStorage)) return;

  const saved = JSON.parse(await readFile(runPaths.authSessionStorage, 'utf8')) as {
    origin: string;
    entries: Record<string, string>;
  };

  const expectedOrigin = new URL(config.lendenClubUrl).origin;
  if (saved.origin !== expectedOrigin) {
    throw new Error(
      `Saved LenDenClub sessionStorage origin mismatch: expected ${expectedOrigin}, got ${saved.origin}. ` +
        `Run: $env:LENDER_USERNAME='${config.username}'; npm run auth`,
    );
  }

  // Playwright storageState does not include sessionStorage. Install it before the
  // first LenDenClub navigation so the app sees the same session-scoped values as
  // the authenticated browser that produced the saved state.
  await context.addInitScript(
    ({ origin, entries }) => {
      if (window.location.origin !== origin) return;
      for (const [key, value] of Object.entries(entries)) {
        window.sessionStorage.setItem(key, value);
      }
    },
    { origin: saved.origin, entries: saved.entries },
  );
});

// Sequential inside one process by design; separate username processes may run in parallel.
test(`execute LenDenClub lending workflow for ${config.username}`, async ({ page }) => {
  // Verify the saved browser session before the workflow creates a backend lending session
  // or reaches any financial browser action.
  await new AuthSessionVerifier().assertReusable(page);

  const workflow = new LendingWorkflowService(page);
  await workflow.execute();
});
