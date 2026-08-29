import type { Page } from '@playwright/test';
import { config } from '../config/Config';
import { logger } from '../utils/Logger';

export class AuthSessionVerifier {
  async assertReusable(page: Page): Promise<void> {
    await page.goto(`${config.lendenClubUrl}/manual-lending`, { waitUntil: 'domcontentloaded' });

    const redirectedToLogin = /\/login(?:[/?#]|$)/i.test(page.url());
    const loginUiVisible = await page
      .locator('#otp, input[name="phone"]')
      .first()
      .isVisible()
      .catch(() => false);

    if (redirectedToLogin || loginUiVisible) {
      throw this.expiredSessionError();
    }

    // Negative checks alone are not enough: positively prove the authenticated app shell loaded.
    // #live-loans is the same stable control used by ManualLendingPage to enter Live Loans.
    const authenticatedShellVisible = await page
      .locator('#live-loans')
      .isVisible({ timeout: config.uiTimeout })
      .catch(() => false);

    if (!authenticatedShellVisible) {
      throw new Error(
        `Saved LenDenClub session for username ${config.username} could not be verified because the authenticated app shell did not load. ` +
          `Run: $env:LENDER_USERNAME='${config.username}'; npm run auth`,
      );
    }

    logger.info(`Verified reusable LenDenClub authenticated session for username=${config.username}`);
  }

  private expiredSessionError(): Error {
    return new Error(
      `Saved LenDenClub session for username ${config.username} is missing or expired. ` +
        `Run: $env:LENDER_USERNAME='${config.username}'; npm run auth`,
    );
  }
}
