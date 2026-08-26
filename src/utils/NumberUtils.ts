export function parseMoney(value: string | undefined | null): number {
  if (!value?.trim()) throw new Error('Money value is missing');
  const normalized = value.replace(/[₹,$\s]/g, '').replace(/,/g, '');
  const number = Number(normalized);
  if (!Number.isFinite(number)) throw new Error(`Invalid money value: ${value}`);
  return number;
}

export function parseNumber(value: string | undefined | null): number {
  if (!value?.trim()) throw new Error('Numeric value is missing');
  const number = Number(value.replace(/,/g, '').trim());
  if (!Number.isFinite(number)) throw new Error(`Invalid numeric value: ${value}`);
  return number;
}

export function parsePercent(value: string | undefined | null): number {
  if (!value?.trim()) throw new Error('Percent value is missing');
  return parseNumber(value.replace('%', ''));
}

export function parseMonths(value: string | undefined | null): number {
  if (!value?.trim()) throw new Error('Tenure value is missing');
  const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!match) throw new Error(`Invalid tenure value: ${value}`);
  const number = Number(match[0]);
  if (!Number.isFinite(number)) throw new Error(`Invalid tenure value: ${value}`);
  return number;
}
