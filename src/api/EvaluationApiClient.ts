import { z } from 'zod';
import { config } from '../config/Config';
import type { EvaluationRequest } from '../models/EvaluationRequest';
import type { EvaluationResponse } from '../models/EvaluationResponse';
import { BaseApiClient } from './BaseApiClient';

const responseSchema = z.object({
  loanId: z.string(),
  sessionId: z.string(),
  decision: z.string(),
  riskLevel: z.string(),
  investmentAmount: z.coerce.number().nonnegative(),
  rule: z.string(),
  reason: z.string(),
  evaluationId: z.coerce.number(),
});

export class EvaluationApiClient extends BaseApiClient {
  async evaluateBorrower(rule: string, request: EvaluationRequest): Promise<EvaluationResponse> {
    const path = `${config.evaluationPath}/${encodeURIComponent(rule)}`;
    const data = await this.post<unknown>(path, request);
    return responseSchema.parse(data) as EvaluationResponse;
  }
}
