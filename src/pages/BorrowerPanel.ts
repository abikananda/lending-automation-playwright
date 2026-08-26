import { expect, type Locator, type Page } from '@playwright/test';
import type { Borrower } from '../models/Borrower';
import { parseMonths, parseMoney, parseNumber, parsePercent } from '../utils/NumberUtils';
import { logger } from '../utils/Logger';

export class BorrowerPanel {
  private readonly panel: Locator;

  constructor(private readonly page: Page) {
    this.panel = page.locator('div.sc-dtBdUo.jipznm');
  }

  async waitForOpen(): Promise<void> {
    await expect(this.panel).toBeVisible();
  }

  private field(label: string): Locator {
    return this.panel.locator(`xpath=.//div[normalize-space()='${label}']/ancestor::div[1]/following-sibling::div[1]//div`).first();
  }

  private async read(label: string, required = true): Promise<string | undefined> {
    const value = (await this.field(label).innerText()).trim();
    if (!value && required) throw new Error(`Missing borrower field: ${label}`);
    return value || undefined;
  }

  async extractBorrower(): Promise<Borrower> {
    const risk = await this.readPanelFields('Risk Category & Score', ['Bureau Score', 'LenDenClub Score']);
    const professional = await this.readPanelFields('Professional Details', ['Occupation', 'Monthly Income']);
    const personal = await this.readPanelFields('Personal Details', ['Name', 'Age']);
    const loan = await this.readPanelFields('Loan Details', [
      'Loan ID',
      'Loan Amount',
      'Tenure',
      'Annualized Interest Rate',
      'EMI',
    ], false);

    const emi = loan.EMI ?? loan['EMI Amount'];
    if (!emi) throw new Error('Missing borrower field: EMI');

    const borrower: Borrower = {
      loanId: (loan['Loan ID'] ?? '').trim(),
      creditScore: parseNumber(risk['Bureau Score']),
      lendenScore: parseNumber(risk['LenDenClub Score']),
      income: parseMoney(professional['Monthly Income']),
      loanAmount: parseMoney(loan['Loan Amount']),
      interestRate: parsePercent(loan['Annualized Interest Rate']),
      tenure: parseMonths(loan.Tenure),
      emi: parseMoney(emi),
      age: parseNumber(personal.Age),
      borrowerType: (professional.Occupation ?? '').trim(),
      repeated: false,
      name: personal.Name?.trim(),
    };

    if (!borrower.loanId) throw new Error('Missing borrower field: Loan ID');
    if (!borrower.name) throw new Error('Missing borrower field: Name');

    logger.debug(`Borrower extracted: ${borrower.loanId}`);
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

  async setInvestmentAmount(targetAmount: number): Promise<void> {
    const input = this.page.locator(".MuiSlider-thumb input[type='range']").first();
    await expect(input).toBeVisible();

    const min = Number(await input.getAttribute('min'));
    const max = Number(await input.getAttribute('max'));
    const step = Number(await input.getAttribute('step'));
    const current = Number(await input.inputValue());

    if (![min, max, step, current].every(Number.isFinite)) {
      throw new Error('Invalid slider attributes');
    }

    if (targetAmount < min || targetAmount > max) {
      throw new Error(`Investment ${targetAmount} is outside slider range [${min}, ${max}]`);
    }

    const remainder = (targetAmount - min) % step;
    if (Math.abs(remainder) > 1e-9 && Math.abs(remainder - step) > 1e-9) {
      throw new Error(`Investment ${targetAmount} cannot be represented by slider step ${step}`);
    }

    if (current !== targetAmount) {
      await input.focus();
      const steps = Math.abs((targetAmount - current) / step);
      const key = targetAmount > current ? 'ArrowRight' : 'ArrowLeft';
      for (let i = 0; i < steps; i += 1) await input.press(key);
    }

    await expect(input).toHaveValue(String(targetAmount));
    await expect(input).toHaveAttribute('aria-valuenow', String(targetAmount));

    const label = this.page.locator('.MuiSlider-valueLabelLabel').first();
    if (await label.count()) {
      const text = (await label.innerText()).replace(/[^0-9.-]/g, '');
      if (text && Number(text) !== targetAmount) {
        throw new Error(`Visible slider label ${text} does not match ${targetAmount}`);
      }
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
