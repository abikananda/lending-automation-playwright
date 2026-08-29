# Parallel lender execution

Each Playwright process must set one `LENDER_USERNAME`, matching `lender.username` in the backend database.

The backend session starts with:

```http
GET /api/lender/data?username=<LENDER_USERNAME>
```

Browser auth state is isolated automatically:

```text
playwright/.auth/<LENDER_USERNAME>.json
```

Reports and test artifacts are also isolated per username:

```text
playwright-report/<LENDER_USERNAME>/
test-results/<LENDER_USERNAME>/
```

## First-time authentication

PowerShell:

```powershell
$env:LENDER_USERNAME='abikananda'; npm run auth
$env:LENDER_USERNAME='seconduser'; npm run auth
```

Run authentication only when that username's saved LenDenClub session is missing or expired.

## Parallel execution

Open two terminals.

Terminal 1:

```powershell
$env:LENDER_USERNAME='abikananda'; npm test
```

Terminal 2:

```powershell
$env:LENDER_USERNAME='seconduser'; npm test
```

The two processes use separate browser cookies/storage, backend lending sessions, reports, screenshots, traces and videos.
