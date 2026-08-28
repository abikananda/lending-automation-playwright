# LenDenClub Lending Automation — TypeScript + Playwright

This project is a Playwright migration of the existing `abikananda/lending-automation` Selenium implementation. The browser workflow was preserved where the repository provided concrete behavior, while database, Gmail/OTP, Drools, and persistence responsibilities were moved behind REST API clients as required by the migration prompt.

## Architecture

```text
                    TypeScript + Playwright
                             |
                 +-----------+-----------+
                 |                       |
              Browser                 REST API
                 |                       |
                 v                       v
        LenDenClub UI             Spring Boot Backend
                                         |
                                         v
                                       MySQL
```

### Playwright owns

- Login page interaction
- OTP entry/verification
- Manual lending navigation
- Filters and sorting
- Borrower cards and borrower detail panel
- UI field extraction and normalization
- Investment slider
- Add Loan
- Continue
- Success URL validation
- Browser screenshots/traces/video through Playwright

### Backend owns

- Lender/session data
- OTP retrieval
- Borrower evaluation
- Rule/business logic
- Database access
- Persistence/report storage when endpoints are exposed

No MySQL driver, Gmail client, or Drools engine is included in this project.

## Selenium migration analysis

The current Selenium repository contains:

- `P2PAutomation` — sequential rule execution and wallet tracking
- `LendingOrchestrator` — login, rule-specific loan-list navigation, filtering, scraping, finalization, reporting
- `LoginService` — phone/OTP login and navigation to live/repeated/fast/daily/monthly loan lists
- `FilterAndSortService` — filter selections and five sort operations
- `BorrowerScraper` — scrolling, card detection, borrower opening, NPA/current-lending filtering, rule evaluation, Add Loan
- `BorrowerDetailParser` — four borrower panels and UI field extraction
- `SliderHandler` — slider min/max/step inspection and multi-strategy adjustment/verification
- `LendingFinalizer` — final lending action and success validation
- `ExecutionMetrics` / `ReportGenerator` — execution reporting

The repository also contains direct DB access and Gmail OTP reading. Those responsibilities are deliberately **not** copied into this project.

## Selenium → Playwright mapping

| Existing Selenium | New Playwright |
|---|---|
| `P2PAutomation.java` | `src/tests/lending.spec.ts` + `LendingWorkflowService` |
| `LendingOrchestrator.java` | `LendingWorkflowService.ts` |
| `LoginService.java` | `LoginPage.ts` + `LoginService.ts` |
| `LendenClubOtpReader.java` | `OtpApiClient.ts` |
| `DBService.java` | `PersistenceApiClient.ts` |
| `FilterAndSortService.java` | `ManualLendingPage.ts` |
| `BorrowerScraper.java` | `ManualLendingPage.ts` + `BorrowerPanel.ts` + `BorrowerService.ts` |
| `BorrowerDetailParser.java` | `BorrowerPanel.ts` |
| `SliderHandler.java` | `BorrowerPanel.setInvestmentAmount()` |
| `LendButtonHandler.java` | `ManualLendingPage.clickContinue()` |
| `SuccessValidator.java` | `ManualLendingPage.validateSuccess()` |
| `ExecutionMetrics.java` | `ExecutionReport.ts` |
| `ReportGenerator.java` | Playwright HTML report + `ExecutionReport` persistence |
| Drools engine/rules | Backend evaluation API |

## UI behavior migrated

### Login

The existing selectors are preserved:

- `input[name="phone"]`
- `#otp`
- `Send OTP`
- `button[type="submit"]` with `Verify OTP`
- post-login URL containing `/manual-lending`

### Rule-specific navigation

The old Selenium implementation used rule-name/config flags to choose:

- repeated borrowers
- filling-fast loans
- daily repayment loans
- monthly repayment loans
- live loans

The new `LendingRuleService` keeps the backend-provided rule order and derives only the UI filter/navigation flags. It does **not** evaluate the actual lending rule.

### Filters

Migrated from the Selenium implementation:

- Select All
- Salaried vs Self-employed
- Remove up-to-₹25,000 option
- Low/medium/high-risk specific exclusions
- LenDenClub Score: Higher to Lower
- Loan amount: Lower to Higher
- Tenure: Lower to Higher
- Income: Higher to Lower
- Interest Rate: Higher to Lower
- Apply

### Borrower extraction

The existing four panels are preserved:

1. Risk Category & Score
2. Professional Details
3. Personal Details
4. Loan Details

The new model also includes `emi` because the target evaluation API requires it. The old Selenium parser did **not** extract EMI, so the Playwright version expects an EMI field in the current UI and fails the borrower if it is absent rather than silently sending zero.

### Slider

The old Selenium implementation inspected `min`, `max`, `step`, and current value. The Playwright implementation does the same and uses keyboard movement against the range input. It refuses to silently clamp or round an evaluation amount that cannot be represented by the slider step.

### Financial-action safety

- Wallet is checked before every investment.
- Add Loan is not blindly retried.
- Continue is not blindly retried.
- A borrower-specific failure captures a screenshot and continues.
- Critical workflow/API failures stop the workflow.
- Borrowers are processed sequentially (`workers: 1`).

## API integration

### Lender data

```http
GET /api/lender/data
```

Expected structure follows the migration prompt:

```json
{
  "sessionId": "LS-...",
  "lender": {
    "lenderId": "...",
    "name": "...",
    "walletAmount": 10000,
    "username": "...",
    "mobileNumber": "...",
    "otpUsername": "...",
    "lendingRules": ["RULE_A", "RULE_B"],
    "active": true
  },
  "session": {
    "status": "STARTED",
    "startedAt": "..."
  }
}
```

### OTP

```http
GET /api/fetchOtp/{identifier}
```

The client supports a plain OTP string and `{ "otp": "..." }` / `{ "code": "..." }` responses.

OTP is never logged.

### Evaluation

```http
POST /api/borrower/evaluate/{rule}
```

The request includes `sessionId` and the normalized borrower fields. The response must contain:

- `loanId`
- `sessionId`
- `decision`
- `riskLevel`
- `investmentAmount`
- `rule`
- `reason`
- `evaluationId`

Playwright only acts on `decision`; it does not calculate risk or implement lending rules.

### Persistence

Persistence endpoints are intentionally configurable through `.env`:

```text
PERSIST_BORROWER_PATH
PERSIST_EVALUATION_PATH
PERSIST_INVESTMENT_PATH
PERSIST_SESSION_PATH
PERSIST_RESULT_PATH
```

If an endpoint is blank, the corresponding persistence call is skipped. No direct database fallback is implemented.

## Environment

Copy `.env.example` to `.env` and configure:

```env
LENDENCLUB_URL=https://app.lendenclub.com
BACKEND_URL=http://localhost:8080
HEADLESS=false
SLOW_MO=100
API_TIMEOUT=30000
UI_TIMEOUT=30000
LENDING_SUCCESS_URL_PATTERN=manual-lending-success
```

## Install

```bash
npm install
npx playwright install
```

## How to run the project

### 1. Create or refresh the saved LenDenClub login session

Run this only the first time, or whenever the saved LenDenClub session expires:

```bash
npm run auth
```

This performs the OTP login once and saves the authenticated browser state locally under `playwright/.auth/`.

### 2. Run the lending automation

```bash
npm test
```

Normal runs reuse the saved LenDenClub authentication state, so OTP login is not repeated.

### 3. Run in explicit headed mode

```bash
npm run test:headed
```

### 4. Run in Playwright debug mode

```bash
npm run test:debug
```

### 5. Build / type-check

```bash
npm run build
```

### 6. Lint

```bash
npm run lint
```

### 7. Format / verify formatting

```bash
npm run format
npm run format:check
```

If a normal run fails with:

```text
Saved LenDenClub session is missing or expired. Run: npm run auth
```

refresh the login state once:

```bash
npm run auth
```

and then run the project again:

```bash
npm test
```

## Reports

Playwright generates:

- HTML report: `playwright-report/`
- screenshots/traces/video on failures: `test-results/`
- optional backend execution result through `PERSIST_RESULT_PATH`

## Important assumptions / items to verify against the current UI/backend

1. The migration prompt defines the three backend APIs for lender data, OTP, and evaluation. The repository itself does not expose those Spring Boot API implementations, so response compatibility was based on the supplied API contract.
2. Persistence endpoint paths were not present in the Selenium repository. They are therefore configuration-driven and are not invented.
3. The Selenium repository's borrower parser does not extract EMI, while the supplied evaluation API contract requires EMI. The new automation treats missing EMI as a borrower extraction failure.
4. The old `LendButtonHandler` actually clicks `Continue`; there is no separate Selenium implementation of a second UI `Lend` action in that class. The Playwright project preserves this observed behavior as `clickContinue()`.
5. The Selenium slider implementation finalizes a rule after selecting loans. The migration prompt explicitly requires slider → Add Loan per borrower, so the Playwright workflow follows that financial-action sequence while retaining the same slider constraints and verification philosophy.
6. Exact selectors are migrated from the current Selenium code. Because LenDenClub is a live application, selector changes should be validated with a real headed run before production execution.

## Validation performed here

All 25 TypeScript source files were parsed successfully with the installed TypeScript compiler's transpiler. A full `npm run build` could not be completed in this environment because dependencies were not installed; `npm install` timed out before creating `node_modules`. Run the install commands above locally, then run `npm run build` and `npm test`.
