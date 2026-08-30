import { z } from 'zod';
import { config } from '../config/Config';
import type { EvaluationRequest } from '../models/EvaluationRequest';
import type { EvaluationResponse } from '../models/EvaluationResponse';
import { BaseApiClient } from './BaseApiClient';

const responseSchema = z.object({
  loanId: z.string(),
  sessionId: z.string(),
  decision: z.string().nullable(),
  riskLevel: z.string().nullable(),
  investmentAmount: z.coerce.number().nonnegative(),
  rule: z.string().nullable(),
  ruleVersion: z.string().min(1),
  rulesetVersion: z.string().min(1),
  engineVersion: z.string().min(1),
  reason: z.string().nullable(),
  evaluationId: z.coerce.number().nullable(),
});

export class EvaluationApiClient extends BaseApiClient {
  async evaluateBorrower(rule: string, request: EvaluationRequest): Promise<EvaluationResponse> {
    const path = `${config.evaluationPath}/${encodeURIComponent(rule)}`;
    this.logApiRequest('POST', path, 'BORROWER_EVALUATION');
    const data = await this.post<unknown>(path, request);
    const result = responseSchema.parse(data) as EvaluationResponse;
    this.logApiSuccess(
      'BORROWER_EVALUATION',
      `loanId=${result.loanId} decision=${result.decision ?? 'NONE'} riskLevel=${result.riskLevel ?? 'NONE'} investmentAmount=${result.investmentAmount} evaluationId=${result.evaluationId ?? 'NONE'} ruleVersion=${result.ruleVersion} rulesetVersion=${result.rulesetVersion} engineVersion=${result.engineVersion}`,
    );
    return result;
  }
}
