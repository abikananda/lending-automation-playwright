import type { PersistenceApiClient } from '../api/PersistenceApiClient';
import type { EvaluationResponse } from '../models/EvaluationResponse';
import type { BorrowerExecutionRecord, ExecutionReport } from '../models/ExecutionReport';
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

  async persistFinalizedRule(
    sessionId: string,
    rule: string,
    records: BorrowerExecutionRecord[],
  ): Promise<BorrowerExecutionRecord[]> {
    const failures: string[] = [];
    const persisted: BorrowerExecutionRecord[] = [];

    for (const record of records) {
      if (
        record.rule !== rule ||
        record.status !== 'FINALIZED' ||
        !record.loanId ||
        record.investmentAmount === undefined
      ) {
        continue;
      }

      try {
        await this.api.saveInvestment({
          sessionId,
          loanId: record.loanId,
          investmentAmount: record.investmentAmount,
          status: 'SUCCESS',
          message: `Confirmed by Playwright workflow rule=${record.rule}`,
        });
        record.status = 'PERSISTED';
        persisted.push(record);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failures.push(`${record.loanId}: ${reason}`);
        logger.error(
          `Confirmed investment persistence failed sessionId=${sessionId} loanId=${record.loanId}: ${reason}`,
        );
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `Confirmed lending succeeded but backend investment history is incomplete; manual reconciliation required: ${failures.join('; ')}`,
      );
    }

    return persisted;
  }

  async result(report: ExecutionReport): Promise<void> {
    const unpersisted = report.records.filter((record) => record.status === 'FINALIZED');
    if (unpersisted.length > 0) {
      throw new Error(
        `Cannot finalize report: ${unpersisted.length} confirmed investment(s) have not been persisted`,
      );
    }
    await this.api.saveResult(report);
  }
}
