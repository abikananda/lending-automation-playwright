# Run two lenders in parallel (PowerShell)

Authenticate each lender once (or whenever its saved session expires):

```powershell
$env:LENDER_ID='LENDER_A'; npm run auth
$env:LENDER_ID='LENDER_B'; npm run auth
```

Then use two PowerShell terminals.

Terminal A:

```powershell
$env:LENDER_ID='LENDER_A'
npm test
```

Terminal B:

```powershell
$env:LENDER_ID='LENDER_B'
npm test
```

Each process automatically uses a different auth-state file and report/output directories.
