import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function numberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
  return parsed;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (!value) return fallback;
  return value.toLowerCase() === 'true';
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export const config = {
  lendenClubUrl: required('LENDENCLUB_URL', 'https://app.lendenclub.com'),
  backendUrl: required('BACKEND_URL', 'http://localhost:8080'),
  username: required('LENDER_USERNAME'),
  backendApiKey: optional('BACKEND_API_KEY'),
  backendAuthHeader: required('BACKEND_AUTH_HEADER', 'X-API-Key'),
  headless: boolEnv('HEADLESS', false),
  slowMo: numberEnv('SLOW_MO', 100),
  apiTimeout: numberEnv('API_TIMEOUT', 30_000),
  uiTimeout: numberEnv('UI_TIMEOUT', 30_000),
  lendingSuccessUrlPattern: required('LENDING_SUCCESS_URL_PATTERN', 'manual-lending-success'),
  backendHealthPath: required('BACKEND_HEALTH_PATH', '/actuator/health'),
  lenderDataPath: required('LENDER_DATA_PATH', '/api/lender/data'),
  lenderSessionPath: required('LENDER_SESSION_PATH', '/api/lender/session'),
  otpPath: required('OTP_PATH', '/api/fetchOtp'),
  evaluationPath: required('EVALUATION_PATH', '/api/borrower/evaluate'),
  npaBorrowerPath: required('NPA_BORROWER_PATH', '/api/npa-borrowers'),
  persistence: {
    borrower: process.env.PERSIST_BORROWER_PATH,
    evaluation: process.env.PERSIST_EVALUATION_PATH,
    investment: process.env.PERSIST_INVESTMENT_PATH,
    session: process.env.PERSIST_SESSION_PATH,
    result: process.env.PERSIST_RESULT_PATH,
  },
} as const;
