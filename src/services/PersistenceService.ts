import type { PersistenceApiClient } from '../api/PersistenceApiClient';
import type { EvaluationResponse } from '../models/EvaluationResponse';
import type { ExecutionReport } from '../models/ExecutionReport';
import type { LenderDataResponse } from '../models/LenderData';
import type { Borrower } from '../models/Borrower';

export class PersistenceService {
  constructor(private readonly api: PersistenceApiClient) {}

  async session(data: LenderDataResponse): Promise<void> {
    await this.api.saveSession(data);
  }

  async borrower(sessionId: string, borrower: Borrower): Promise<void> {
    await this.api.saveBorrower(sessionId, borrower);
  }

  async evaluation(evaluation: EvaluationResponse): Promise<void> {
    await this.api.saveEvaluation(evaluation);
  }

  async investment(data: unknown): Promise<void> {
    await this.api.saveInvestment(data);
  }

  async result(report: ExecutionReport): Promise<void> {
    await this.api.saveResult(report);
  }
}
