import { describe, expect, it } from '@playwright/test';
import { config } from './Config';
import { runPaths } from './RunPaths';

describe('RunPaths', () => {
  it('isolates auth and artifacts by lender id', () => {
    const safe = config.lenderId.replace(/[^a-zA-Z0-9._-]/g, '_');
    expect(runPaths.authState.endsWith(`${safe}.json`)).toBeTruthy();
    expect(runPaths.testResults.endsWith(safe)).toBeTruthy();
    expect(runPaths.htmlReport.endsWith(safe)).toBeTruthy();
  });
});
