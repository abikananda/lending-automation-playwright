import { expect, type Locator, type Page } from '@playwright/test';
import type { Borrower } from '../models/Borrower';
import { parseMonths, parseMoney, parseNumber, parsePercent } from '../utils/NumberUtils';
import { logger } from '../utils/Logger';

export class BorrowerPanel {
  private readonly panel: Locator;

  constructor(private readonly page: Page) {
    this.panel = page.locator('div.sc-dtBdUo.hHvdph');
  }

  async waitForOpen(): Promise<void> {
    await expect(this.panel).toBeVisible();
  }

  private field(label: string): Locator {
    return this.panel.locator(`xpath=.//div[normalize-space()='${label}']/ancestor::div[1]/following-sibling::div[1]//div`).first();
  }

  private async read(label: string, required = true): Promise<string | undefined> {
    const locator = this.field(label);
    if ((await locator.count()) === 0) {
      if (required) throw new Error(`Missing borrower field: ${label}`);
      return undefined;
    }

    const value = (await locator.innerText()).trim();
    if (!value && required) throw new Error(`Missing borrower field: ${label}`);
    return value || undefined;
  }

  async extractBorrower(): Promise<Borrower> {
    const risk = await this.readPanelFields(
      'Risk Category & Score',
      ['Bureau Score', 'LenDenClub Score', 'Risk Category'],
      false,
    );
    const professional = await this.readPanelFields('Professional Details', ['Occupation', 'Monthly Income']);
    const personal = await this.readPanelFields('Personal Details', ['Name', 'Age', 'Gender'], false);
    const loan = await this.readPanelFields(
      'Loan Details',
      [
        'Loan ID',
        'Loan Amount',
        'Tenure',
        'Annualized Interest Rate',
        'Loan Type',
        'Repayment Frequency',
      ],
      false,
    );

    const borrower: Borrower = {
      loanId: (loan['Loan ID'] ?? '').trim(),
      creditScore: parseNumber(risk['Bureau Score']),
      lendenScore: parseNumber(risk['LenDenClub Score']),
      income: parseMoney(professional['Monthly Income']),
      loanAmount: parseMoney(loan['Loan Amount']),
      interestRate: parsePercent(loan['Annualized Interest Rate']),
      tenure: parseMonths(loan.Tenure),
      emi: parseMoney(loan['Loan Amount']) / parseMonths(loan.Tenure),
      age: parseNumber(personal.Age),
      borrowerType: (professional.Occupation ?? '').trim(),
      repeated: false,
      name: (personal.Name ?? '').trim(),
      loanType: loan['Loan Type']?.trim(),
      repaymentFrequency: loan['Repayment Frequency']?.trim(),
      gender: personal.Gender?.trim(),
      riskCategory: risk['Risk Category']?.trim(),
    };

    if (!borrower.loanId) throw new Error('Missing borrower field: Loan ID');
    if (!borrower.name) throw new Error('Missing borrower field: Name');

    logger.debug(
      `Borrower extracted: ${borrower.loanId} additionalFields=${JSON.stringify({
        loanType: borrower.loanType,
        repaymentFrequency: borrower.repaymentFrequency,
        gender: borrower.gender,
        riskCategory: borrower.riskCategory,
      })}`,
    );
    return borrower;
  }

  private async expandPanel(panelHeader: string): Promise<void> {
    const button = this.page
      .locator('button', { has: this.page.locator('span', { hasText: panelHeader }) })
      .first();
    if (await button.count() === 0) {
      throw new Error(`Panel not found: ${panelHeader}`);
    }
    if ((await button.getAttribute('aria-expanded')) !== 'true') {
      await button.click();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
    }
  }

  private async readPanelFields(
    panelHeader: string,
    labels: string[],
    required = true,
  ): Promise<Record<string, string | undefined>> {
    await this.expandPanel(panelHeader);
    const values: Record<string, string | undefined> = {};
    for (const label of labels) {
      values[label] = await this.read(label, required);
    }
    return values;
  }

  async close(): Promise<void> {
    const close = this.panel.locator('svg').first();
    if (await close.count()) {
      await close.click({ force: true });
      await expect(this.panel).toBeHidden({ timeout: 5_000 }).catch(() => undefined);
    }
  }

  async addLoan(): Promise<void> {
    const button = this.panel.getByRole('button', { name: 'Add Loan', exact: true });
    await expect(button).toBeEnabled();
    await button.click();

    // A click is not treated as success. Require a UI state change.
    await expect(button).toBeDisabled().catch(async () => {
      await expect(button).toHaveCount(0).catch(() => undefined);
    });
  }
}
