import { expect, type Locator, type Page } from '@playwright/test';
import type { BorrowerSummary } from '../models/Borrower';
import { config } from '../config/Config';
import { BorrowerPanel } from './BorrowerPanel';

export interface RuleUiOptions {
  repeated: boolean;
  lowHighRisk: boolean;
  business: boolean;
}

export class ManualLendingPage {
  constructor(private readonly page: Page) {}

  private readonly cardLocator = 'div.MuiBox-root.css-79elbk';

  async waitForPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/manual-lending/);
  }

  async goDashboard(): Promise<void> {
    await this.page.locator('#home').click();
  }

  async openLiveLoans(): Promise<void> {
    await this.page.locator('#live-loans').click();
    await this.waitForPage();
  }

  private async openIconLoan(path: string): Promise<void> {
    await this.goDashboard();
    const image = this.page.locator(`img[src='${path}']`).first();
    await expect(image).toBeVisible();
    await image.click({ force: true });
    await this.waitForPage();
  }

  async openRepeatedBorrowers(): Promise<void> {
    await this.openIconLoan('https://ldc-prod-cms.lendenclub.com/repeat-loans-icon.png');
  }

  async openFillingFastLoans(): Promise<void> {
    await this.openIconLoan('https://ldc-prod-cms.lendenclub.com/filling-fast-icon.png');
  }

  async openDailyRepaymentLoans(): Promise<void> {
    await this.openIconLoan('https://ldc-prod-cms.lendenclub.com/daily-repayment-icon.png');
  }

  async openMonthlyRepaymentLoans(): Promise<void> {
    await this.openIconLoan('https://ldc-prod-cms.lendenclub.com/monthly-repayment-icon.png');
  }

  async openLoanListForRule(rule: string): Promise<void> {
    if (/repeated/i.test(rule)) return this.openRepeatedBorrowers();
    if (/filling fast/i.test(rule)) return this.openFillingFastLoans();
    if (/daily repayment/i.test(rule)) return this.openDailyRepaymentLoans();
    if (/monthly repayment/i.test(rule)) return this.openMonthlyRepaymentLoans();
    return this.openLiveLoans();
  }

  async applyFiltersAndSort(options: RuleUiOptions): Promise<void> {
    await this.page.getByText('Filter & Sort', { exact: false }).first().click();

    await this.setCheckbox("//label[span[text()='Select All']]/preceding-sibling::span//input[@type='checkbox']", true);

    await this.setCheckbox(
      "//label[.//span[contains(text(),'Salaried')]]/preceding-sibling::span//input[@type='checkbox']",
      !options.business,
    );
    await this.setCheckbox(
      "//label[.//span[contains(text(),'Self-employed')]]/preceding-sibling::span//input[@type='checkbox']",
      options.business,
    );

    await this.setCheckbox(
      "(//label[.//span[contains(text(),'Upto ₹ 25,000')]]/preceding-sibling::span//input[@type='checkbox'])[1]",
      false,
    );

    if (options.lowHighRisk) {
      const filters = [
        "//label[.//span[contains(text(),'12 Months (Monthly)')]]/preceding-sibling::span//input[@type='checkbox']",
        "//label[.//span[contains(text(),'12 Months (Daily)')]]/preceding-sibling::span//input[@type='checkbox']",
        "//label[.//span[contains(text(),'A (High)')]]/preceding-sibling::span//input[@type='checkbox']",
        "(//label[.//span[contains(text(),'₹ 25,001 to ₹ 50,000')]]/preceding-sibling::span//input[@type='checkbox'])[1]",
        "(//label[.//span[contains(text(),'₹ 50,001 to ₹ 1,00,000')]]/preceding-sibling::span//input[@type='checkbox'])[2]",
        "(//label[.//span[contains(text(),'More than ₹ 1,00,000')]]/preceding-sibling::span//input[@type='checkbox'])[2]",
        "//label[.//span[contains(text(),'₹ 1 to ₹ 1000')]]/preceding-sibling::span//input[@type='checkbox']",
      ];
      for (const filter of filters) await this.setCheckbox(filter, false);
    }

    await this.page.getByRole('button', { name: 'Sort', exact: true }).click();
    await this.sort('LenDenClub Score', 'Higher to Lower');
    await this.sort('Loan amount', 'Lower to Higher');
    await this.sort('Tenure', 'Lower to Higher');
    await this.sort('Income', 'Higher to Lower');
    await this.sort('Interest Rate', 'Higher to Lower');

    const apply = this.page.getByRole('button', { name: 'Apply', exact: true });
    await apply.click();
    await expect(apply).toBeHidden({ timeout: config.uiTimeout });
  }

  private async sort(field: string, direction: string): Promise<void> {
    const button = this.page
      .locator('p', { hasText: field })
      .locator('xpath=following-sibling::div[1]')
      .getByRole('button', { name: direction, exact: true });
    await button.click();
  }

  private async setCheckbox(xpath: string, shouldBeChecked: boolean): Promise<void> {
    const checkbox = this.page.locator(`xpath=${xpath}`).first();
    await expect(checkbox).toBeVisible();
    if ((await checkbox.isChecked()) !== shouldBeChecked) await checkbox.click();
  }

  async scrollToLoadMoreCards(): Promise<void> {
    const candidates = [
      this.page.locator("div[class*='MuiBox-root'][style*='overflow']").first(),
      this.page.locator('div.MuiBox-root.css-rvjv84').first(),
      this.page.locator('main, [role="main"], .MuiContainer-root').first(),
    ];

    for (const container of candidates) {
      if (await container.count() && await container.isVisible().catch(() => false)) {
        const before = await container.evaluate((el) => (el as HTMLElement).scrollTop);
        await container.evaluate((el) => {
          const node = el as HTMLElement;
          node.scrollTop += node.clientHeight * 0.8;
        });
        await expect.poll(async () => container.evaluate((el) => (el as HTMLElement).scrollTop), {
          timeout: 5_000,
        }).toBeGreaterThan(before).catch(() => undefined);
        return;
      }
    }

    await this.page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
  }

  async getBorrowers(): Promise<BorrowerSummary[]> {
    const seen = new Set<string>();
    const result: BorrowerSummary[] = [];
    let previousCount = 0;

    for (let retry = 0; retry < 12; retry += 1) {
      await this.scrollToLoadMoreCards();
      await expect.poll(async () => this.page.locator(this.cardLocator).count(), {
        timeout: 5_000,
      }).toBeGreaterThanOrEqual(previousCount).catch(() => undefined);

      const cards = this.page.locator(this.cardLocator);
      const count = await cards.count();
      if (count === previousCount) break;
      previousCount = count;

      for (let i = 0; i < count; i += 1) {
        const card = cards.nth(i);
        const name = (await card.locator('div.css-69i1ev p.MuiTypography-root').first().innerText().catch(async () =>
          card.locator("xpath=.//div[contains(@class,'css-69i1ev')]//p[1]").innerText(),
        )).trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        result.push({ name });
      }
    }

    return result;
  }

  async openBorrowerByName(name: string): Promise<BorrowerPanel> {
    const card = this.page.locator(this.cardLocator).filter({ hasText: name }).first();
    await expect(card).toBeVisible();
    const arrow = card.locator("div[aria-label='View borrower details']");
    await arrow.scrollIntoViewIfNeeded();
    await arrow.click({ force: true });
    const panel = new BorrowerPanel(this.page);
    await panel.waitForOpen();
    return panel;
  }

  async clickContinue(): Promise<void> {
    const continueButton = this.page.getByRole('button', { name: /Continue/ }).first();
    await expect(continueButton).toBeVisible();
    await continueButton.click();
  }

  async validateSuccess(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(config.lendingSuccessUrlPattern));
  }

  async getCardLocator(): Promise<Locator> {
    return this.page.locator(this.cardLocator);
  }
}
