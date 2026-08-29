# Authenticate lender A once
$env:LENDER_USERNAME='abikananda'
npm run auth

# Authenticate lender B once
$env:LENDER_USERNAME='seconduser'
npm run auth

# For parallel execution, open two PowerShell terminals.
# Terminal A:
$env:LENDER_USERNAME='abikananda'
npm test

# Terminal B:
$env:LENDER_USERNAME='seconduser'
npm test
