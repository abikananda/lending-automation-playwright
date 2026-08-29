# LenDenClub Lending Automation — TypeScript + Playwright

This project automates the LenDenClub browser workflow while keeping lender/session data, OTP retrieval, borrower evaluation, NPA checks and persistence behind the Spring Boot backend.

## Prerequisites

Install these before running the project:

- Node.js 22+
- npm
- Chromium for Playwright
- LenDenClub risk-engine/backend running locally

The default backend URL is `http://localhost:8080`.

## Initial setup

Clone the repository and install dependencies:

```powershell
git clone https://github.com/abikananda/lending-automation-playwright.git
cd lending-automation-playwright
npm ci
npx playwright install chromium
```

Create `.env` from `.env.example` and configure the required values. Each Playwright process must specify the lender by `lender.username`:

```env
LENDER_USERNAME=abikananda
BACKEND_URL=http://localhost:8080
```

If backend API-key authentication is enabled, also configure:

```env
BACKEND_API_KEY=<your-api-key>
BACKEND_AUTH_HEADER=X-API-Key
```

Do not commit secrets or your local `.env` file.

## Build and validate

Type-check the TypeScript project without executing the lending workflow:

```powershell
npm run build
```

Run ESLint:

```powershell
npm run lint
```

Optional formatting checks:

```powershell
npm run format:check
```

To automatically format files locally:

```powershell
npm run format
```

`npm run build` and `npm run lint` are safe validation commands. They do not execute the live lending workflow.

## Runtime lender selection

Each Playwright process selects one lender by `lender.username`:

```powershell
$env:LENDER_USERNAME='abikananda'
```

The backend request is:

```http
GET /api/lender/data?username=abikananda
```

The backend creates a lender-specific `lending_session` and returns the configured investment amount and lending rules from that lender's enabled `investment_config` row.

## Authenticate a lender

Each username owns a separate Playwright storage-state file:

```text
playwright/.auth/abikananda.json
playwright/.auth/seconduser.json
```

Before the first lending run for a username, authenticate it:

```powershell
$env:LENDER_USERNAME='abikananda'
npm run auth
```

Run this command again whenever that lender's saved LenDenClub browser session expires.

The authentication setup retrieves the selected lender from the backend, performs the LenDenClub login/OTP flow and saves that browser session under the username-specific auth-state file.

## Run the lending workflow

> **Warning:** the lending test can perform real financial actions. Do not run it merely to verify that the project compiles.

Make sure:

1. The backend is running and healthy.
2. The lender has an enabled `investment_config` row with the intended amount and lending rules.
3. `LENDER_USERNAME` points to the intended lender.
4. That username has a valid saved browser authentication state.

Then run:

```powershell
$env:LENDER_USERNAME='abikananda'
npm test
```

For an explicitly headed run:

```powershell
$env:LENDER_USERNAME='abikananda'
npm run test:headed
```

For Playwright debugging:

```powershell
$env:LENDER_USERNAME='abikananda'
npm run test:debug
```

The normal lending workflow is intentionally not executed by CI because it can perform real investments.

## Recommended local workflow

For a fresh checkout:

```powershell
npm ci
npx playwright install chromium
npm run build
npm run lint

$env:LENDER_USERNAME='abikananda'
npm run auth

# Run only after verifying the backend investment configuration.
npm test
```

For subsequent runs when dependencies and authentication have not changed:

```powershell
npm run build
npm run lint

$env:LENDER_USERNAME='abikananda'
npm test
```

## Parallel lenders

Run different usernames in separate terminals. Each process remains internally sequential (`workers: 1`), while independent lender processes can run concurrently.

Terminal 1:

```powershell
$env:LENDER_USERNAME='abikananda'
npm test
```

Terminal 2:

```powershell
$env:LENDER_USERNAME='seconduser'
npm test
```

Each process has separate browser cookies/storage, backend sessions and output directories.

## Reports and failure artifacts

Reports and test artifacts are isolated by username:

```text
playwright-report/<username>/
test-results/<username>/
```

For example:

```text
playwright-report/abikananda/
test-results/abikananda/
```

Open the generated Playwright HTML report with:

```powershell
npx playwright show-report playwright-report/abikananda
```

Replace `abikananda` with the username used for that run.

## Borrower panel data

The borrower extractor reads the existing evaluation fields plus these confirmed additional UI fields:

- `Loan` -> `Type`
- `Loan` -> `Repayment Frequency`
- `Personal` -> `Gender`
- `Risk Category & Score` -> `Risk Category`

These additional fields are sent to the backend for persistence only. They do not change Drools evaluation or investment decisions.

## Safety

- Playwright does not read or write MySQL directly.
- Backend evaluation remains the source of lending decisions.
- Active NPA borrowers are loaded once per workflow run and block Add Loan after an `INVEST` evaluation.
- Add Loan and Continue are not blindly retried.
- Wallet/config checks happen before investment.
- A missing or expired username-specific browser state fails the run instead of reusing another lender's authentication.
- Use `npm run build` and `npm run lint` for non-financial code validation; do not use `npm test` as a build check.

See `docs/INVESTMENT_CONFIG.md` and `docs/PARALLEL_LENDERS.md` for additional setup examples.
