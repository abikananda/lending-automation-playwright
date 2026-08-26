import { config } from '../config/Config';
import { BaseApiClient } from './BaseApiClient';
import type { Borrower } from '../models/Borrower';
import type { EvaluationResponse } from '../models/EvaluationResponse';
import type { ExecutionReport } from '../models/ExecutionReport';
import type { LenderDataResponse } from '../models/LenderData';

export class PersistenceApiClient extends BaseApiClient {
  async saveSession(data: LenderDataResponse): Promise<void> {
    if (!config.persistence.session) return;
    await this.post(config.persistence.session, data);
  }

  async saveBorrower(sessionId: string, borrower: Borrower): Promise<void> {
    if (!config.persistence.borrower) return;
    await this.post(config.persistence.borrower, { sessionId, borrower });
  }

  async saveEvaluation(evaluation: EvaluationResponse): Promise<void> {
    if (!config.persistence.evaluation) return;
    await this.post(config.persistence.evaluation, evaluation);
  }

  async saveInvestment(data: unknown): Promise<void> {
    if (!config.persistence.investment) return;
    // This endpoint is persistence-only; it must not trigger a second investment action.
    await this.post(config.persistence.investment, data);
  }

  async saveResult(report: ExecutionReport): Promise<void> {
    if (!config.persistence.result) return;
    await this.post(config.persistence.result, report);
  }
}
