import { config } from '../config/Config';
import { BaseApiClient } from './BaseApiClient';
import type { Borrower } from '../models/Borrower';
import type { EvaluationResponse } from '../models/EvaluationResponse';
import type { ExecutionReport } from '../models/ExecutionReport';
import type { LenderDataResponse } from '../models/LenderData';

export class PersistenceApiClient extends BaseApiClient {
  async saveSession(data: LenderDataResponse): Promise<void> {
    if (!config.persistence.session) return;
    this.logApiRequest('POST', config.persistence.session, 'SAVE_SESSION');
    await this.post(config.persistence.session, data);
    this.logApiSuccess('SAVE_SESSION', `sessionId=${data.sessionId}`);
  }

  async saveBorrower(sessionId: string, borrower: Borrower): Promise<void> {
    if (!config.persistence.borrower) return;
    this.logApiRequest('POST', config.persistence.borrower, 'SAVE_BORROWER');
    await this.post(config.persistence.borrower, { sessionId, borrower });
    this.logApiSuccess('SAVE_BORROWER', `sessionId=${sessionId} loanId=${borrower.loanId}`);
  }

  async saveEvaluation(evaluation: EvaluationResponse): Promise<void> {
    if (!config.persistence.evaluation) return;
    this.logApiRequest('POST', config.persistence.evaluation, 'SAVE_EVALUATION');
    await this.post(config.persistence.evaluation, evaluation);
    this.logApiSuccess('SAVE_EVALUATION', `evaluationId=${evaluation.evaluationId} loanId=${evaluation.loanId}`);
  }

  async saveInvestment(data: unknown): Promise<void> {
    if (!config.persistence.investment) return;
    this.logApiRequest('POST', config.persistence.investment, 'SAVE_INVESTMENT');
    // Financial bookkeeping for an already-confirmed browser action: never retry automatically.
    await this.postFinancial(config.persistence.investment, data);
    this.logApiSuccess('SAVE_INVESTMENT');
  }

  async saveResult(report: ExecutionReport): Promise<void> {
    if (!config.persistence.result) return;
    this.logApiRequest('POST', config.persistence.result, 'SAVE_RESULT');
    await this.post(config.persistence.result, report);
    this.logApiSuccess('SAVE_RESULT');
  }
}
