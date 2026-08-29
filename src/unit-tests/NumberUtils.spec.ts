import { expect, test } from '@playwright/test';
import { parseMonths, parseMoney, parseNumber, parsePercent } from '../utils/NumberUtils';

test.describe('NumberUtils', () => {
  test('parses money with currency symbols, commas and whitespace', () => {
    expect(parseMoney(' ₹ 1,23,456.78 ')).toBe(123456.78);
    expect(parseMoney('$2,500')).toBe(2500);
  });

  test('parses numeric scores and percentages', () => {
    expect(parseNumber(' 800 ')).toBe(800);
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parsePercent('36.48%')).toBe(36.48);
  });

  test('extracts month count from display text', () => {
    expect(parseMonths('4 Months')).toBe(4);
    expect(parseMonths('Tenure: 12 months')).toBe(12);
  });

  test('rejects missing and malformed values', () => {
    expect(() => parseMoney(undefined)).toThrow('Money value is missing');
    expect(() => parseNumber('abc')).toThrow('Invalid numeric value');
    expect(() => parsePercent('percent')).toThrow();
    expect(() => parseMonths('unknown')).toThrow('Invalid tenure value');
  });
});
