import { expect, test } from '@playwright/test';
import type { Borrower } from '../models/Borrower';
import { toEvaluationRequest } from '../models/EvaluationRequest';

const borrower: Borrower = {
  loanId: 'LOA-123',
  creditScore: 701,
  lendenScore: 800,
  income: 50_000,
  loanAmount: 5_000,
  interestRate: 36.48,
  tenure: 4,
  emi: 1_250,
  age: 32,
  borrowerType: 'SALARIED',
  repeated: true,
  name: 'Test Borrower',
  loanType: 'Personal Loan',
  repaymentFrequency: 'Monthly',
  gender: 'Male',
  riskCategory: 'High Risk',
};

test.describe('toEvaluationRequest', () => {
  test('maps all evaluation and persistence fields without renaming or dropping values', () => {
    expect(toEvaluationRequest('SESSION-1', borrower)).toEqual({
      sessionId: 'SESSION-1',
      loanId: 'LOA-123',
      borrowerName: 'Test Borrower',
      creditScore: 701,
      lendenScore: 800,
      income: 50_000,
      loanAmount: 5_000,
      interestRate: 36.48,
      tenure: 4,
      emi: 1_250,
      age: 32,
      borrowerType: 'SALARIED',
      repeated: true,
      loanType: 'Personal Loan',
      repaymentFrequency: 'Monthly',
      gender: 'Male',
      riskCategory: 'High Risk',
    });
  });

  test('keeps optional borrower-panel fields undefined when not available', () => {
    const minimal = { ...borrower };
    delete minimal.loanType;
    delete minimal.repaymentFrequency;
    delete minimal.gender;
    delete minimal.riskCategory;

    const request = toEvaluationRequest('SESSION-2', minimal);

    expect(request.loanType).toBeUndefined();
    expect(request.repaymentFrequency).toBeUndefined();
    expect(request.gender).toBeUndefined();
    expect(request.riskCategory).toBeUndefined();
  });
});
