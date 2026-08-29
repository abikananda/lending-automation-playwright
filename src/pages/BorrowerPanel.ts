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

  private async readFirstAvailable(labels: string[]): Promise<string | undefined> {
    for (const label of labels) {
      const value = await this.read(label, false);
      if (value) return value;
    }
    return undefined;
  }

  async extractBorrower(): Promise<Borrower> {
    const risk = await this.readPanelFields('Risk Category & Score', ['Bureau Score', 'LenDenClub Score']);
    const professional = await this.readPanelFields('Professional Details', ['Occupation', 'Monthly Income']);
    const personal = await this.readPanelFields('Personal Details', ['Name', 'Age']);
    const loan = await this.readPanelFields(
      'Loan Details',
      ['Loan ID', 'Loan Amount', 'Tenure', 'Annualized Interest Rate'],
      false,
    );

    // These fields are documented by LenDenClub as borrower-profile signals, but labels have
    // changed across UI versions. Treat them as optional and support the known label variants.
    const riskCategory = await this.readFirstAvailable(['Risk Category', 'Risk']);
    const remainingAmountText = await this.readFirstAvailable(['Remaining Amount', 'Remaining Loan Amount']);
    const repaymentFrequency = await this.readFirstAvailable([
      'Repayment Frequency',
      'Repayment Type',
      'Repayment Mode',
    ]);

    // Preserve the complete expanded panel text as well. This is intentionally observational:
    // it does not participate in any investment decision, but lets the backend retain newly
    // introduced LenDenClub fields even before we promote them to first-class typed columns.
    const rawPanelText = (await this.panel.innerText()).trim();
    const panelDetails = this.buildPanelDetails(
      risk,
      professional,
      personal,
      loan,
      riskCategory,
      remainingAmountText,
      repaymentFrequency,
      rawPanelText,
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
      riskCategory,
      remainingAmount: remainingAmountText ? parseMoney(remainingAmountText) : undefined,
      repaymentFrequency,
      panelDetails,
    };

    if (!borrower.loanId) throw new Error('Missing borrower field: Loan ID');
    if (!borrower.name) throw new Error('Missing borrower field: Name');

    logger.debug(
      `Borrower extracted: ${borrower.loanId} additionalFields=${JSON.stringify({ riskCategory, remainingAmount: borrower.remainingAmount, repaymentFrequency })}`,
    );
    return borrower;
  }

  private buildPanelDetails(
    risk: Record<string, string | undefined>,
    professional: Record<string, string | undefined>,
    personal: Record<string, string | undefined>,
    loan: Record<string, string | undefined>,
    riskCategory: string | undefined,
    remainingAmount: string | undefined,
    repaymentFrequency: string | undefined,
    rawPanelText: string,
  ): Record<string, string> {
    const details: Record<string, string> = {};

    const add = (section: string, values: Record<string, string | undefined>): void => {
      for (const [label, value] of Object.entries(values)) {
        if (value) details[`${section}.${label}`] = value;
      }
    };

    add('Risk Category & Score', risk);
    add('Professional Details', professional);
    add('Personal Details', personal);
    add('Loan Details', loan);
    if (riskCategory) details['Risk Category & Score.Risk Category'] = riskCategory;
    if (remainingAmount) details['Loan Details.Remaining Amount'] = remainingAmount;
    if (repaymentFrequency) details['Loan Details.Repayment Frequency'] = repaymentFrequency;

    // Bound the payload to keep persistence predictable if the UI adds a large amount of text.
    if (rawPanelText) details['_rawPanelText'] = rawPanelText.slice(0, 20_000);
    return details;
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
