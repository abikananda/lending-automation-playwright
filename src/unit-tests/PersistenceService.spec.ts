import { expect, test } from '@playwright/test';
import type { PersistenceApiClient } from '../api/PersistenceApiClient';
import type { ExecutionReport } from '../models/ExecutionReport';
import { PersistenceService } from '../services/PersistenceService';

const report: ExecutionReport = {
  sessionId: 'SESSION-1',
  lenderId: 'LENDER-1',
  lenderName: 'Test',
  initialWallet: 1000,
  finalWallet: 750,
  totalBorrowers: 1,
  evaluatedBorrowers: 1,
  investedBorrowers: 1,
  skippedBorrowers: 0,
  failedBorrowers: 0,
  totalInvestment: 250,
  records: [{ rule: 'Bulk Lenders', loanId: 'LOAN-1', status: 'FINALIZED', investmentAmount: 250 }],
  errors: [],
};

test('records a confirmed rule immediately and does not send its SUCCESS again in the final report', async () => {
  const investmentCalls: unknown[] = [];
  let reportCalls = 0;
  const api = {
    saveInvestment: async (payload: unknown) => { investmentCalls.push(payload); },
    saveResult: async () => { reportCalls += 1; },
  } as unknown as PersistenceApiClient;
  const service = new PersistenceService(api);

  await service.recordFinalizedInvestments(report.sessionId, report.records);
  await service.result(report);

  expect(investmentCalls).toEqual([{
    sessionId: 'SESSION-1',
    loanId: 'LOAN-1',
    investmentAmount: 250,
    status: 'SUCCESS',
    message: 'Confirmed by Playwright workflow rule=Bulk Lenders',
  }]);
  expect(reportCalls).toBe(1);
});

test('stops the report when a confirmed investment cannot be recorded', async () => {
  let reportCalls = 0;
  const api = {
    saveInvestment: async () => { throw new Error('backend unavailable'); },
    saveResult: async () => { reportCalls += 1; },
  } as unknown as PersistenceApiClient;

  await expect(new PersistenceService(api).result(report)).rejects.toThrow('manual reconciliation required');
  expect(reportCalls).toBe(0);
});
