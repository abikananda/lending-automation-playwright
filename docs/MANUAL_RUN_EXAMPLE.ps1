# Authenticate lender A once
$env:LENDER_ID='LENDER_A'
npm run auth

# Authenticate lender B once
$env:LENDER_ID='LENDER_B'
npm run auth

# For parallel execution, open two PowerShell terminals.
# Terminal A:
$env:LENDER_ID='LENDER_A'
npm test

# Terminal B:
$env:LENDER_ID='LENDER_B'
npm test
