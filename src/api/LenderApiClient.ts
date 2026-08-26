import { z } from 'zod';
import { config } from '../config/Config';
import type { LenderDataResponse } from '../models/LenderData';
import { BaseApiClient } from './BaseApiClient';

const lenderSchema = z.object({
  lenderId: z.string().min(1),
  name: z.string(),
  walletAmount: z.coerce.number().nonnegative(),
  username: z.string(),
  mobileNumber: z.string().min(1),
  otpUsername: z.string().optional(),
  lendingRules: z.array(z.string()),
  active: z.boolean(),
});

const responseSchema = z.object({
  sessionId: z.string().min(1),
  lender: lenderSchema,
  session: z.object({ status: z.string(), startedAt: z.string() }),
});

export class LenderApiClient extends BaseApiClient {
  async getLenderData(): Promise<LenderDataResponse> {
    this.logApiRequest('GET', config.lenderDataPath, 'LENDER_DATA');
    const data = await this.get<unknown>(config.lenderDataPath);
    const result = responseSchema.parse(data) as LenderDataResponse;
    this.logApiSuccess('LENDER_DATA', `lenderId=${result.lender.lenderId} sessionId=${result.sessionId}`);
    return result;
  }
}
