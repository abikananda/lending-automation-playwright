import type { EvaluationApiClient } from '../api/EvaluationApiClient';
import type { PersistenceApiClient } from '../api/PersistenceApiClient';
import type { Borrower } from '../models/Borrower';
import { toEvaluationRequest } from '../models/EvaluationRequest';
import type { EvaluationResponse } from '../models/EvaluationResponse';

export class BorrowerService {
  constructor(
    private readonly evaluationApi: EvaluationApiClient,
    private readonly persistenceApi: PersistenceApiClient,
  ) {}

  async evaluate(sessionId: string, rule: string, borrower: Borrower): Promise<EvaluationResponse> {
    await this.persistenceApi.saveBorrower(sessionId, borrower);
    const evaluation = await this.evaluationApi.evaluateBorrower(rule, toEvaluationRequest(sessionId, borrower));
    await this.persistenceApi.saveEvaluation(evaluation);
    return evaluation;
  }
}
