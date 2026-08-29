# Investment config and lender selection

The backend owns per-run investment amount and lending rules in `investment_config`. Playwright selects which lender to run by setting `LENDER_USERNAME` to that lender's `username`.

Example PowerShell:

```powershell
$env:LENDER_USERNAME='abikananda'; npm test
```

Playwright sends the selected username to:

```http
GET /api/lender/data?username=abikananda
```

The response contains the amount and rules loaded from that lender's enabled `investment_config` row. Playwright does not read or modify the database directly.
