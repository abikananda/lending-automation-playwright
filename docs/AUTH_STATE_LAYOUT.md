# Browser auth state layout

Saved browser sessions are isolated by lender username:

```text
playwright/.auth/abikananda.json
playwright/.auth/seconduser.json
```

Failure artifacts are also isolated by username:

```text
test-results/abikananda/
test-results/seconduser/
playwright-report/abikananda/
playwright-report/seconduser/
```

Never reuse one username's storage-state file for another lender.
