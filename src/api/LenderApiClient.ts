import { z } from 'zod';
import { config } from '../config/Config';
import type { Lender, LenderDataResponse } from '../models/LenderData';
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

export type WorkflowCheckpointState =
  | 'DISCOVERED'
  | 'EXTRACTED'
  | 'EVALUATED'
  | 'APPROVED'
  | 'UI_SELECTED'
  | 'CONTINUE_CLICKED'
  | 'PLATFORM_CONFIRMED'
  | 'BACKEND_RECORDED'
  | 'SKIPPED'
  | 'FAILED'
  | 'UNCERTAIN';

export class LenderApiClient extends BaseApiClient {
  async getLenderConfig(): Promise<Lender> {
    this.logApiRequest('GET', config.lenderConfigPath, 'LENDER_CONFIG');
    const data = await this.get<unknown>(config.lenderConfigPath, {
      params: { username: config.username },
    });
    const lender = lenderSchema.parse(data) as Lender;
    this.assertUsername(lender.username);
    this.logApiSuccess('LENDER_CONFIG', `username=${lender.username}`);
    return lender;
  }

  async startSession(ownerId: string): Promise<LenderDataResponse> {
    this.logApiRequest('POST', config.lenderSessionPath, 'START_SESSION');
    const data = await this.postFinancial<unknown>(
      config.lenderSessionPath,
      { ownerId },
      { params: { username: config.username } },
    );
    const result = responseSchema.parse(data) as LenderDataResponse;
    this.assertUsername(result.lender.username);
    this.logApiSuccess('START_SESSION', `username=${result.lender.username} sessionId=${result.sessionId}`);
    return result;
  }

  async heartbeat(sessionId: string): Promise<void> {
    const path = `${config.lenderSessionPath}/${encodeURIComponent(sessionId)}/heartbeat`;
    this.logApiRequest('POST', path, 'SESSION_HEARTBEAT');
    await this.postFinancial<unknown>(path, {});
    this.logApiSuccess('SESSION_HEARTBEAT', `sessionId=${sessionId}`);
  }

  async checkpoint(
    sessionId: string,
    state: WorkflowCheckpointState,
    details: { loanId?: string; rule?: string; message?: string } = {},
  ): Promise<void> {
    const path = `${config.lenderSessionPath}/${encodeURIComponent(sessionId)}/checkpoint`;
    this.logApiRequest('POST', path, 'WORKFLOW_CHECKPOINT');
    await this.postFinancial<unknown>(path, { state, ...details });
    this.logApiSuccess(
      'WORKFLOW_CHECKPOINT',
      `sessionId=${sessionId} state=${state}${details.loanId ? ` loanId=${details.loanId}` : ''}`,
    );
  }

  async completeSession(sessionId: string): Promise<void> {
    const path = `${config.lenderSessionPath}/${encodeURIComponent(sessionId)}/complete`;
    this.logApiRequest('POST', path, 'COMPLETE_SESSION');
    await this.postFinancial<unknown>(path, {});
    this.logApiSuccess('COMPLETE_SESSION', `sessionId=${sessionId}`);
  }

  private assertUsername(username: string): void {
    if (username !== config.username) {
      throw new Error(`Backend returned username ${username}, expected ${config.username}`);
    }
  }
}
