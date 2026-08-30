import type { EvaluationApiClient } from '../api/EvaluationApiClient';
import type { PersistenceApiClient } from '../api/PersistenceApiClient';
import type { Borrower } from '../models/Borrower';
import { toEvaluationRequest } from '../models/EvaluationRequest';
import type { EvaluationResponse } from '../models/EvaluationResponse';
import { logger } from '../utils/Logger';

export class BorrowerService {
  constructor(
    private readonly evaluationApi: EvaluationApiClient,
    private readonly persistenceApi: PersistenceApiClient,
  ) {}

  async evaluate(sessionId: string, rule: string, borrower: Borrower): Promise<EvaluationResponse> {
    const request = toEvaluationRequest(sessionId, borrower);
    logger.info(
      `Borrower before API rule=${rule} sessionId=${sessionId} payload=${JSON.stringify(request)}`,
    );

    await this.persistenceApi.saveBorrower(sessionId, borrower);
    const evaluation = await this.evaluationApi.evaluateBorrower(rule, request);
    await this.persistenceApi.saveEvaluation(evaluation);
    return evaluation;
  }
}
