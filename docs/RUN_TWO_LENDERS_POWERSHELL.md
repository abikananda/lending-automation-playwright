# Run two lenders in parallel (PowerShell)

Authenticate each username once (or whenever its saved session expires):

```powershell
$env:LENDER_USERNAME='abikananda'; npm run auth
$env:LENDER_USERNAME='seconduser'; npm run auth
```

Then use two PowerShell terminals.

Terminal A:

```powershell
$env:LENDER_USERNAME='abikananda'
npm test
```

Terminal B:

```powershell
$env:LENDER_USERNAME='seconduser'
npm test
```

Each process automatically uses a different username-based auth-state file and report/output directories.
