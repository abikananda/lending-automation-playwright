import { expect, type Page } from '@playwright/test';
import { config } from '../config/Config';

export class LoginPage {
  constructor(private readonly page: Page) {}

  private get phoneInput() { return this.page.locator('input[name="phone"]'); }
  private get otpInput() { return this.page.locator('#otp'); }
  private get sendOtpButton() { return this.page.getByText('Send OTP', { exact: true }); }
  private get verifyOtpButton() {
    return this.page.locator('button[type="submit"]', { hasText: 'Verify OTP' });
  }

  async open(): Promise<void> {
    await this.page.goto('/login', { waitUntil: 'domcontentloaded' });
  }

  async enterMobileNumber(mobileNumber: string): Promise<void> {
    await this.phoneInput.fill(mobileNumber);
  }

  async clickSendOtp(): Promise<void> {
    await this.sendOtpButton.click();
  }

  async enterOtp(otp: string): Promise<void> {
    await this.otpInput.fill(otp);
  }

  async clickVerifyOtp(): Promise<void> {
    await this.verifyOtpButton.click();
  }

  async waitForLoginSuccess(): Promise<void> {
    await expect(this.page).toHaveURL(/\/manual-lending/, { timeout: config.uiTimeout });
  }

  async login(mobileNumber: string, otp: string): Promise<void> {
    await this.open();
    await this.enterMobileNumber(mobileNumber);
    await this.clickSendOtp();
    await this.enterOtp(otp);
    await this.clickVerifyOtp();
    await this.waitForLoginSuccess();
  }
}
