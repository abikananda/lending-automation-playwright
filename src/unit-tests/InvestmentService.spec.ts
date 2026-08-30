import { expect, test } from '@playwright/test';
import type { Lender } from '../models/LenderData';
import { InvestmentService } from '../services/InvestmentService';

const lender = (walletAmount = 10_000): Lender => ({
  lenderId: 'LENDER-1',
  name: 'Test Lender',
  walletAmount,
  username: 'test-user',
  mobileNumber: '9999999999',
  lendingRules: [],
  active: true,
});

test.describe('InvestmentService', () => {
  test('tracks reserved investment and remaining wallet', () => {
    const service = new InvestmentService(lender());

    service.reserveAfterSuccessfulAddLoan(2_000);
    service.reserveAfterSuccessfulAddLoan(1_500);

    expect(service.investedAmount).toBe(3_500);
    expect(service.remainingWallet).toBe(6_500);
  });

  test('rejects zero, negative and non-finite amounts', () => {
    const service = new InvestmentService(lender());

    for (const amount of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => service.validateInvestmentAmount(amount)).toThrow('Invalid investment amount');
    }
  });

  test('prevents reserving more than the remaining wallet', () => {
    const service = new InvestmentService(lender(3_000));

    service.reserveAfterSuccessfulAddLoan(2_000);

    expect(() => service.reserveAfterSuccessfulAddLoan(1_001)).toThrow('Wallet protection');
    expect(service.investedAmount).toBe(2_000);
    expect(service.remainingWallet).toBe(1_000);
  });

  test('allows an amount exactly equal to remaining wallet', () => {
    const service = new InvestmentService(lender(2_500));

    service.reserveAfterSuccessfulAddLoan(2_500);

    expect(service.investedAmount).toBe(2_500);
    expect(service.remainingWallet).toBe(0);
    expect(service.canFundAnotherInvestment()).toBe(false);
  });

  test('reports wallet as non-investable below the minimum ₹250 amount', () => {
    const service = new InvestmentService(lender(499));

    service.reserveAfterSuccessfulAddLoan(250);

    expect(service.remainingWallet).toBe(249);
    expect(service.canFundAnotherInvestment()).toBe(false);
  });

  test('continues when exactly ₹250 remains', () => {
    const service = new InvestmentService(lender(500));

    service.reserveAfterSuccessfulAddLoan(250);

    expect(service.remainingWallet).toBe(250);
    expect(service.canFundAnotherInvestment()).toBe(true);
  });
});
