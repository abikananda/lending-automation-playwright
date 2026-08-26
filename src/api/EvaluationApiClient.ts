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
    this.logApiRequest('POST', path, 'BORROWER_EVALUATION');
    const data = await this.post<unknown>(path, request);
    const result = responseSchema.parse(data) as EvaluationResponse;
    this.logApiSuccess(
      'BORROWER_EVALUATION',
      `loanId=${result.loanId} decision=${result.decision} riskLevel=${result.riskLevel} investmentAmount=${result.investmentAmount} evaluationId=${result.evaluationId}`,
    );
    return result;
  }
}
