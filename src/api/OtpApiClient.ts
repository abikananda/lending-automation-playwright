import { z } from 'zod';
import { config } from '../config/Config';
import { BaseApiClient } from './BaseApiClient';

const otpSchema = z.union([
  z.string().regex(/^\d{4,8}$/),
  z.object({ otp: z.string().regex(/^\d{4,8}$/) }),
  z.object({ code: z.string().regex(/^\d{4,8}$/) }),
]);

export class OtpApiClient extends BaseApiClient {
  async fetchOtp(identifier: string): Promise<string> {
    const path = `${config.otpPath}/${encodeURIComponent(identifier)}`;
    this.logApiRequest('GET', config.otpPath, 'OTP_FETCH');
    const data = await this.get<unknown>(path);
    const parsed = otpSchema.parse(data);
    const otp = typeof parsed === 'string' ? parsed : 'otp' in parsed ? parsed.otp : parsed.code;
    this.logApiSuccess('OTP_FETCH', 'OTP received and validated');
    return otp;
  }
}
