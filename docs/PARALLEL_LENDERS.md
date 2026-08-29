# Parallel lender execution

Each Playwright process must set one `LENDER_ID`, matching `lender.external_lender_id` in the backend database.

Browser auth state is isolated automatically:

```text
playwright/.auth/<LENDER_ID>.json
```

Reports and test artifacts are also isolated per lender:

```text
playwright-report/<LENDER_ID>/
test-results/<LENDER_ID>/
```

## First-time authentication

PowerShell:

```powershell
$env:LENDER_ID='LENDER_A'; npm run auth
$env:LENDER_ID='LENDER_B'; npm run auth
```

Run authentication only when that lender's saved LenDenClub session is missing or expired.

## Parallel execution

Open two terminals.

Terminal 1:

```powershell
$env:LENDER_ID='LENDER_A'; npm test
```

Terminal 2:

```powershell
$env:LENDER_ID='LENDER_B'; npm test
```

The two processes use separate browser cookies/storage, backend lending sessions, reports, screenshots, traces and videos.
