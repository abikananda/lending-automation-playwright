import { z } from 'zod';
import { config } from '../config/Config';
import type { LenderDataResponse } from '../models/LenderData';
import { BaseApiClient } from './BaseApiClient';

const lenderSchema = z.object({
  lenderId: z.string().min(1),
  name: z.string(),
  walletAmount: z.coerce.number().nonnegative(),
  username: z.string().min(1),
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
    const data = await this.get<unknown>(config.lenderDataPath, {
      params: { username: config.username },
    });
    const result = responseSchema.parse(data) as LenderDataResponse;
    if (result.lender.username !== config.username) {
      throw new Error(`Backend returned username ${result.lender.username}, expected ${config.username}`);
    }
    this.logApiSuccess('LENDER_DATA', `username=${result.lender.username} sessionId=${result.sessionId}`);
    return result;
  }

  async completeSession(sessionId: string): Promise<void> {
    const path = `${config.lenderSessionPath}/${encodeURIComponent(sessionId)}/complete`;
    this.logApiRequest('POST', path, 'COMPLETE_SESSION');
    await this.postFinancial<unknown>(path, {});
    this.logApiSuccess('COMPLETE_SESSION', `sessionId=${sessionId}`);
  }
}
