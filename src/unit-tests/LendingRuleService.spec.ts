import { expect, test } from '@playwright/test';
import { LendingRuleService } from '../services/LendingRuleService';

test.describe('LendingRuleService', () => {
  const service = new LendingRuleService();

  test('preserves backend-provided rule order while trimming blanks', () => {
    expect(
      service.getRuleOrder([
        '  REPEATED_LENDERS_HIGH_RISK ',
        '',
        'BULK_LENDERS',
        '   ',
        'GOOD_BUSINESS_LENDERS',
      ]),
    ).toEqual(['REPEATED_LENDERS_HIGH_RISK', 'BULK_LENDERS', 'GOOD_BUSINESS_LENDERS']);
  });

  test('detects repeated high-risk rule UI options', () => {
    expect(service.getUiOptions('REPEATED_LENDERS_HIGH_RISK')).toEqual({
      repeated: true,
      lowHighRisk: true,
      business: false,
    });
  });

  test('detects business rules independently from risk classification', () => {
    expect(service.getUiOptions('GOOD_BUSINESS_LENDERS')).toEqual({
      repeated: false,
      lowHighRisk: false,
      business: true,
    });
  });

  test('detects medium risk text regardless of separators/case', () => {
    expect(service.getUiOptions('Repeated Lenders - Medium Risk')).toEqual({
      repeated: true,
      lowHighRisk: true,
      business: false,
    });
  });
});
