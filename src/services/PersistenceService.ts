import type { PersistenceApiClient } from '../api/PersistenceApiClient';
import type { EvaluationResponse } from '../models/EvaluationResponse';
import type { ExecutionReport } from '../models/ExecutionReport';
import type { LenderDataResponse } from '../models/LenderData';
import type { Borrower } from '../models/Borrower';
import { logger } from '../utils/Logger';

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
    for (const record of report.records) {
      if (record.status !== 'FINALIZED' || !record.loanId || !record.investmentAmount) continue;

      try {
        await this.api.saveInvestment({
          sessionId: report.sessionId,
          loanId: record.loanId,
          investmentAmount: record.investmentAmount,
          status: 'SUCCESS',
          message: `Confirmed by Playwright workflow rule=${record.rule}`,
        });
      } catch (error) {
        // Browser investment is already confirmed at this point. Never retry the financial UI
        // action because persistence failed; surface the bookkeeping failure for reconciliation.
        logger.error(
          `Confirmed investment persistence failed sessionId=${report.sessionId} loanId=${record.loanId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    await this.api.saveResult(report);
  }
}
