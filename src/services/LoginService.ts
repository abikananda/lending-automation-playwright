import type { Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { OtpApiClient } from '../api/OtpApiClient';
import { logger } from '../utils/Logger';

export class LoginService {
  constructor(private readonly otpApi: OtpApiClient) {}

  async login(page: Page, mobileNumber: string, otpIdentifier: string): Promise<void> {
    const loginPage = new LoginPage(page);
    await loginPage.open();
    await loginPage.enterMobileNumber(mobileNumber);
    await loginPage.clickSendOtp();

    const otp = await this.otpApi.fetchOtp(otpIdentifier);
    await loginPage.enterOtp(otp);
    await loginPage.clickVerifyOtp();
    await loginPage.waitForLoginSuccess();
    logger.info('Login successful');
  }
}
