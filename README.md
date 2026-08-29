# LenDenClub Lending Automation — TypeScript + Playwright

This project automates the LenDenClub browser workflow while keeping lender/session data, OTP retrieval, borrower evaluation, NPA checks and persistence behind the Spring Boot backend.

## Borrower panel data

The borrower extractor reads the existing evaluation fields plus these confirmed additional UI fields:

- Loan Details -> Loan Type
- Loan Details -> Repayment Frequency
- Personal Details -> Gender
- Risk Category & Score -> Risk Category

These additional fields are sent to the backend for persistence only. They do not change Drools evaluation or investment decisions.
