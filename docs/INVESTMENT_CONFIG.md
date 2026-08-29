# Investment config and lender selection

The backend owns per-run investment amount and lending rules in `investment_config`. Playwright selects which lender to run by setting `LENDER_ID` to that lender's `external_lender_id`.

Example PowerShell:

```powershell
$env:LENDER_ID='LENDER_A'; npm test
```

Playwright sends the selected lender to:

```http
GET /api/lender/data?lenderId=LENDER_A
```

The response contains the amount and rules loaded from that lender's enabled `investment_config` row. Playwright does not read or modify the database directly.
