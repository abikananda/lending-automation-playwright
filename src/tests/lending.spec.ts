import { test } from '@playwright/test';
import { LendingWorkflowService } from '../services/LendingWorkflowService';

// Sequential by design: this workflow performs real financial actions.
test('execute LenDenClub lending workflow', async ({ page }) => {
  const workflow = new LendingWorkflowService(page);
  await workflow.execute();
});
