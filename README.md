# LenDenClub Lending Automation — TypeScript + Playwright

This project automates the LenDenClub browser workflow while keeping lender/session data, OTP retrieval, borrower evaluation, NPA checks and persistence behind the Spring Boot backend.

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

## Browser authentication isolation

Each username owns a separate Playwright storage-state file:

```text
playwright/.auth/abikananda.json
playwright/.auth/seconduser.json
```

Authenticate a username once, or again whenever its saved LenDenClub session expires:

```powershell
$env:LENDER_USERNAME='abikananda'
npm run auth
```

Normal runs reuse that username's saved browser session:

```powershell
$env:LENDER_USERNAME='abikananda'
npm test
```

## Parallel lenders

Run different usernames in separate terminals.

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

Each process remains internally sequential (`workers: 1`) but the two independent processes can run concurrently. Browser cookies/storage, backend sessions and artifacts are isolated by username.

## Reports and failure artifacts

```text
playwright-report/<username>/
test-results/<username>/
```

For example:

```text
playwright-report/abikananda/
test-results/abikananda/
```

## Borrower panel data

The borrower extractor reads the existing evaluation fields plus these confirmed additional UI fields:

- Loan Details -> Loan Type
- Loan Details -> Repayment Frequency
- Personal Details -> Gender
- Risk Category & Score -> Risk Category

These additional fields are sent to the backend for persistence only. They do not change Drools evaluation or investment decisions.

## Safety

- Playwright does not read or write MySQL directly.
- Backend evaluation remains the source of lending decisions.
- Active NPA borrowers are loaded once per workflow run and block Add Loan after an INVEST evaluation.
- Add Loan and Continue are not blindly retried.
- Wallet/config checks happen before investment.
- A missing or expired username-specific browser state fails the run instead of reusing another lender's authentication.

See `docs/INVESTMENT_CONFIG.md` and `docs/PARALLEL_LENDERS.md` for setup examples.
