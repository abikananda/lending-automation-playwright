import { expect, type Locator, type Page } from '@playwright/test';
import type { BorrowerSummary } from '../models/Borrower';
import { config } from '../config/Config';
import { BorrowerPanel } from './BorrowerPanel';
import { logger } from '../utils/Logger';

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

    await this.page.locator("xpath=//button[normalize-space(text())='Sort']").click();
    await this.sort('LenDenClub Score', 'Higher to Lower');
    await this.sort('Loan amount', 'Lower to Higher');
    await this.sort('Tenure', 'Lower to Higher');
    await this.sort('Income', 'Higher to Lower');
    await this.sort('Interest Rate', 'Higher to Lower');

    const apply = this.page.getByRole('button', { name: 'Apply', exact: true });
    await apply.click();
    await expect(apply).toBeHidden({ timeout: config.uiTimeout });
  }

  async closeOpenModalIfPresent(): Promise<void> {
    const modal = this.page.locator('div.MuiModal-root[role="presentation"]').last();
    if (!(await modal.isVisible().catch(() => false))) return;

    await this.page.keyboard.press('Escape').catch(() => undefined);
    await expect(modal).toBeHidden({ timeout: 5_000 }).catch(() => undefined);

    if (await modal.isVisible().catch(() => false)) {
      const closeButton = modal.locator('button[aria-label="close"], button[aria-label="Close"], svg').first();
      if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click({ force: true }).catch(() => undefined);
        await expect(modal).toBeHidden({ timeout: 5_000 }).catch(() => undefined);
      }
    }
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
    const cards = this.page.locator(this.cardLocator);
    const count = await cards.count();

    if (count > 0) {
      const lastCard = cards.nth(count - 1);
      await lastCard.scrollIntoViewIfNeeded().catch(() => undefined);

      await lastCard.evaluate((el) => {
        el.scrollIntoView({ block: 'end', inline: 'nearest' });

        let parent = el.parentElement;
        while (parent) {
          const style = window.getComputedStyle(parent);
          const scrollable = /(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight;
          if (scrollable) {
            parent.scrollTop = parent.scrollHeight;
            break;
          }
          parent = parent.parentElement;
        }
      }).catch(() => undefined);
    }

    await this.page.mouse.wheel(0, 1_500).catch(() => undefined);
    await this.page.evaluate(() => window.scrollBy(0, window.innerHeight)).catch(() => undefined);
  }

  private async collectVisibleBorrowers(seen: Set<string>, result: BorrowerSummary[]): Promise<void> {
    const cards = this.page.locator(this.cardLocator);
    const count = await cards.count();

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

  async getBorrowers(): Promise<BorrowerSummary[]> {
    const seen = new Set<string>();
    const result: BorrowerSummary[] = [];
    const maxScrollAttempts = 30;
    const maxConsecutiveNoGrowth = 3;
    let consecutiveNoGrowth = 0;

    await this.collectVisibleBorrowers(seen, result);
    let previousCardCount = await this.page.locator(this.cardLocator).count();
    logger.info(`Initial borrower cards loaded: ${previousCardCount}`);

    for (let attempt = 1; attempt <= maxScrollAttempts && consecutiveNoGrowth < maxConsecutiveNoGrowth; attempt += 1) {
      await this.scrollToLoadMoreCards();

      const grew = await expect.poll(async () => this.page.locator(this.cardLocator).count(), {
        timeout: 7_000,
        intervals: [250, 500, 1_000],
      }).toBeGreaterThan(previousCardCount).then(() => true).catch(() => false);

      const currentCardCount = await this.page.locator(this.cardLocator).count();
      await this.collectVisibleBorrowers(seen, result);

      if (grew || currentCardCount > previousCardCount) {
        logger.info(
          `Loaded more borrower cards after scroll ${attempt}: ${previousCardCount} -> ${currentCardCount} (unique borrowers: ${result.length})`,
        );
        previousCardCount = currentCardCount;
        consecutiveNoGrowth = 0;
      } else {
        consecutiveNoGrowth += 1;
        logger.info(
          `No new borrower cards after scroll ${attempt} (${consecutiveNoGrowth}/${maxConsecutiveNoGrowth}); currently ${currentCardCount} cards`,
        );
      }
    }

    logger.info(`Finished loading borrower list: ${result.length} unique borrowers discovered`);
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
