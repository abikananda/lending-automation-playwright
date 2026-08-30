import { expect, type Locator, type Page } from '@playwright/test';
import type { Borrower } from '../models/Borrower';
import { parseMonths, parseMoney, parseNumber, parsePercent } from '../utils/NumberUtils';
import { logger } from '../utils/Logger';

export class BorrowerPanel {
  private readonly panel: Locator;
  private static readonly PANEL_OPEN_TIMEOUT_MS = 5_000;
  private static readonly ADD_LOAN_CONFIRM_TIMEOUT_MS = 5_000;

  constructor(private readonly page: Page) {
    this.panel = page.locator('div.sc-dtBdUo.hHvdph');
  }

  async waitForOpen(): Promise<void> {
    await expect(this.panel).toBeVisible({ timeout: BorrowerPanel.PANEL_OPEN_TIMEOUT_MS });
  }

  private fieldWithin(container: Locator, label: string): Locator {
    return container
      .locator(`xpath=.//div[normalize-space()='${label}']/ancestor::div[1]/following-sibling::div[1]//div`)
      .first();
  }

  private async readWithin(
    container: Locator,
    label: string,
    required = true,
  ): Promise<string | undefined> {
    const locator = this.fieldWithin(container, label);
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
    const professional = await this.readPanelFields(
      'Professional Details',
      ['Occupation', 'Monthly Income'],
    );
    const personal = await this.readPanelFields('Personal', ['Name', 'Age', 'Gender'], false);
    const loan = await this.readPanelFields(
      'Loan',
      ['Loan ID', 'Loan Amount', 'Tenure', 'Annualized Interest Rate', 'Type', 'Repayment Frequency'],
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
      loanType: loan.Type?.trim(),
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

  private panelButton(panelHeader: string): Locator {
    return this.page
      .locator('button', { has: this.page.locator('span', { hasText: panelHeader }) })
      .first();
  }

  private async expandPanel(panelHeader: string): Promise<Locator> {
    const button = this.panelButton(panelHeader);
    if (await button.count() === 0) {
      throw new Error(`Panel not found: ${panelHeader}`);
    }
    if ((await button.getAttribute('aria-expanded')) !== 'true') {
      await button.click();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
    }
    return button;
  }

  private async panelSection(panelHeader: string, anchorLabel: string): Promise<Locator> {
    const button = await this.expandPanel(panelHeader);
    const section = button.locator(
      `xpath=ancestor::*[.//div[normalize-space()='${anchorLabel}']][1]`,
    );
    if ((await section.count()) === 0) {
      throw new Error(`Expanded panel content not found: ${panelHeader}`);
    }
    return section;
  }

  private async readPanelFields(
    panelHeader: string,
    labels: string[],
    required = true,
  ): Promise<Record<string, string | undefined>> {
    const section = await this.panelSection(panelHeader, labels[0]);
    const values: Record<string, string | undefined> = {};
    for (const label of labels) {
      values[label] = await this.readWithin(section, label, required);
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

    // Financial action: click exactly once. Never retry this click automatically.
    await button.click();

    // Confirm the click caused one of the known successful UI transitions without
    // first waiting the global 30s timeout for a state that may never occur.
    await expect
      .poll(
        async () => {
          if ((await button.count()) === 0) return true;
          if (!(await this.panel.isVisible().catch(() => false))) return true;
          return button.isDisabled().catch(() => false);
        },
        {
          timeout: BorrowerPanel.ADD_LOAN_CONFIRM_TIMEOUT_MS,
          intervals: [100, 250, 500],
          message: 'Add Loan click did not produce a confirmed UI state change',
        },
      )
      .toBe(true);
  }
}
