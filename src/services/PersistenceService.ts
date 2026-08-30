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
    const failures: string[] = [];

    for (const record of report.records) {
      if (record.status !== 'FINALIZED' || !record.loanId || record.investmentAmount === undefined) {
        continue;
      }

      try {
        await this.api.saveInvestment({
          sessionId: report.sessionId,
          loanId: record.loanId,
          investmentAmount: record.investmentAmount,
          status: 'SUCCESS',
          message: `Confirmed by Playwright workflow rule=${record.rule}`,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failures.push(`${record.loanId}: ${reason}`);
        // The browser investment is already confirmed. Never retry the UI action; continue
        // attempting the remaining bookkeeping records once so reconciliation is complete.
        logger.error(
          `Confirmed investment persistence failed sessionId=${report.sessionId} loanId=${record.loanId}: ${reason}`,
        );
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `Confirmed lending succeeded but backend investment history is incomplete; manual reconciliation required: ${failures.join('; ')}`,
      );
    }

    await this.api.saveResult(report);
  }
}
