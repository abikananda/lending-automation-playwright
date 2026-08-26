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
    const data = await this.get<unknown>(`${config.otpPath}/${encodeURIComponent(identifier)}`);
    const parsed = otpSchema.parse(data);
    if (typeof parsed === 'string') return parsed;
    return 'otp' in parsed ? parsed.otp : parsed.code;
  }
}
