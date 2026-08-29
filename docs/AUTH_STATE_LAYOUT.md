# Browser auth state layout

Saved browser sessions are isolated by lender ID:

```text
playwright/.auth/LENDER_A.json
playwright/.auth/LENDER_B.json
```

Failure artifacts are also isolated:

```text
test-results/LENDER_A/
test-results/LENDER_B/
playwright-report/LENDER_A/
playwright-report/LENDER_B/
```

Never reuse one lender's storage-state file for another lender.
