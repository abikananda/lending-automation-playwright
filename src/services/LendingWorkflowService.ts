import type { Page } from '@playwright/test';
import { LenderApiClient } from '../api/LenderApiClient';
import { OtpApiClient } from '../api/OtpApiClient';
import { EvaluationApiClient } from '../api/EvaluationApiClient';
import { PersistenceApiClient } from '../api/PersistenceApiClient';
import { ManualLendingPage } from '../pages/ManualLendingPage';
import { LoginService } from './LoginService';
import { BorrowerService } from './BorrowerService';
import { LendingRuleService } from './LendingRuleService';
import { InvestmentService } from './InvestmentService';
import { PersistenceService } from './PersistenceService';
import type { ExecutionReport, BorrowerExecutionRecord } from '../models/ExecutionReport';
import type { EvaluationResponse } from '../models/EvaluationResponse';
import type { Borrower } from '../models/Borrower';
import { logger } from '../utils/Logger';
import { captureFailure } from '../utils/ScreenshotUtils';

class UncertainFinancialStateError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'UncertainFinancialStateError';
  }
}

export class LendingWorkflowService {
  private readonly lenderApi = new LenderApiClient();
  private readonly otpApi = new OtpApiClient();
  private readonly evaluationApi = new EvaluationApiClient();
  private readonly persistenceApi = new PersistenceApiClient();
  private readonly ruleService = new LendingRuleService();
  private readonly persistenceService = new PersistenceService(this.persistenceApi);

  constructor(private readonly page: Page) {}

  async execute(): Promise<void> {
    logger.info('Starting lending workflow');

    const lenderData = await this.lenderApi.getLenderData();
    if (!lenderData.lender.active) throw new Error('Lender is inactive; stopping workflow');

    logger.info(`Session: ${lenderData.sessionId}`);
    logger.info(`Lender: ${lenderData.lender.name}`);
    logger.info(`Wallet: ₹${lenderData.lender.walletAmount}`);
    logger.info(`Rules: ${JSON.stringify(lenderData.lender.lendingRules)}`);
    await this.persistenceService.session(lenderData);

    const otpIdentifier = lenderData.sessionId;
    await new LoginService(this.otpApi).login(this.page, lenderData.lender.mobileNumber, otpIdentifier);

    const investment = new InvestmentService(lenderData.lender);
    const borrowerService = new BorrowerService(this.evaluationApi, this.persistenceApi);
    const ui = new ManualLendingPage(this.page);
    const records: BorrowerExecutionRecord[] = [];
    const errors: string[] = [];
    const selectedLoanIds = new Set<string>();
    let evaluated = 0;
    let invested = 0;
    let skipped = 0;
    let failed = 0;
    let totalBorrowers = 0;

    const rules = this.ruleService.getRuleOrder(lenderData.lender.lendingRules);

    for (const rule of rules) {
      try {
        logger.info(`Starting rule: ${rule}`);
        let ruleInvested = 0;
        let ruleBorrowerFailures = 0;
        await ui.openLoanListForRule(rule);
        await ui.applyFiltersAndSort(this.ruleService.getUiOptions(rule));
        const borrowers = await ui.getBorrowers();
        totalBorrowers += borrowers.length;
        logger.info(`Borrowers found for ${rule}: ${borrowers.length}`);

        for (const summary of borrowers) {
          if (!summary.name) continue;

          let panel;
          try {
            panel = await ui.openBorrowerByName(summary.name);
            const borrower = await panel.extractBorrower();
            borrower.repeated = this.ruleService.getUiOptions(rule).repeated;

            const evaluation = await borrowerService.evaluate(lenderData.sessionId, rule, borrower);
            this.validateEvaluationIdentity(evaluation, borrower, lenderData.sessionId, rule);
            evaluated += 1;
            logger.info(
              `Evaluation loan=${evaluation.loanId} decision=${evaluation.decision ?? 'NONE'} risk=${evaluation.riskLevel ?? 'NONE'} amount=₹${evaluation.investmentAmount}`,
            );

            if (evaluation.decision === null) {
              skipped += 1;
              const reason = evaluation.reason ?? 'No investment decision returned by evaluation API';
              logger.info(`Skipping loan=${borrower.loanId}: ${reason}`);
              records.push({
                rule,
                loanId: borrower.loanId,
                borrowerName: borrower.name,
                status: 'SKIPPED',
                reason,
                evaluation,
              });
              await panel.close();
              continue;
            }

            if (evaluation.decision.toUpperCase() !== 'INVEST') {
              skipped += 1;
              records.push({
                rule,
                loanId: borrower.loanId,
                borrowerName: borrower.name,
                status: 'SKIPPED',
                reason: evaluation.reason ?? `Evaluation decision: ${evaluation.decision}`,
                evaluation,
              });
              await panel.close();
              continue;
            }

            if (selectedLoanIds.has(borrower.loanId)) {
              skipped += 1;
              const reason = 'Loan already selected earlier in this workflow; duplicate investment prevented';
              logger.warn(`Skipping duplicate investment loanId=${borrower.loanId} rule=${rule}`);
              records.push({
                rule,
                loanId: borrower.loanId,
                borrowerName: borrower.name,
                status: 'SKIPPED',
                reason,
                evaluation,
              });
              await panel.close();
              continue;
            }

            investment.validateInvestmentAmount(evaluation.investmentAmount);
            await panel.setInvestmentAmount(evaluation.investmentAmount);
            await panel.addLoan();
            investment.reserveAfterSuccessfulAddLoan(evaluation.investmentAmount);
            selectedLoanIds.add(borrower.loanId);
            invested += 1;
            ruleInvested += 1;

            records.push({
              rule,
              loanId: borrower.loanId,
              borrowerName: borrower.name,
              status: 'SELECTED',
              evaluation,
              investmentAmount: evaluation.investmentAmount,
            });

            await panel.close();
          } catch (error) {
            failed += 1;
            ruleBorrowerFailures += 1;
            const reason = error instanceof Error ? error.message : String(error);
            errors.push(`${rule}/${summary.name}: ${reason}`);
            records.push({ rule, borrowerName: summary.name, status: 'FAILED', reason });
            logger.error(`Borrower failed: ${summary.name}: ${reason}`);
            if (panel) await panel.close().catch(() => undefined);
          }
        }

        if (ruleBorrowerFailures > 0) {
          logger.error(`Rule ${rule} completed with ${ruleBorrowerFailures} borrower failure(s)`);
          await captureFailure(this.page, `rule-${rule}-borrowers`);
        }

        // Continue is a financial action; never retry it automatically.
        if (ruleInvested > 0) {
          await ui.clickContinue();
          try {
            await ui.validateSuccess();
          } catch (error) {
            throw new UncertainFinancialStateError(
              `Continue was clicked for rule ${rule}, but lending success could not be confirmed. Workflow stopped to avoid a duplicate financial action.`,
              { cause: error },
            );
          }

          for (const record of records) {
            if (record.rule === rule && record.status === 'SELECTED') record.status = 'FINALIZED';
          }
          logger.info(`Rule ${rule} finalized successfully`);
          await ui.goDashboard();
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        errors.push(`${rule}: ${reason}`);
        failed += 1;
        logger.error(`Rule ${rule} failed: ${reason}`);
        await captureFailure(this.page, `rule-${rule}`);

        if (error instanceof UncertainFinancialStateError) {
          logger.error('Stopping workflow because the financial result is uncertain');
          throw error;
        }

        try {
          await ui.closeOpenModalIfPresent();
          logger.info(`UI cleanup completed after rule failure: ${rule}`);
        } catch (cleanupError) {
          const cleanupReason = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
          logger.warn(`UI cleanup failed after rule ${rule}: ${cleanupReason}`);
        }
      }
    }

    const report: ExecutionReport = {
      sessionId: lenderData.sessionId,
      lenderId: lenderData.lender.lenderId,
      lenderName: lenderData.lender.name,
      initialWallet: lenderData.lender.walletAmount,
      finalWallet: investment.remainingWallet,
      totalBorrowers,
      evaluatedBorrowers: evaluated,
      investedBorrowers: invested,
      skippedBorrowers: skipped,
      failedBorrowers: failed,
      totalInvestment: investment.investedAmount,
      records,
      errors,
    };

    await this.persistenceService.result(report);
    logger.info(`Workflow complete. Total investment: ₹${report.totalInvestment}`);
  }

  private validateEvaluationIdentity(
    evaluation: EvaluationResponse,
    borrower: Borrower,
    sessionId: string,
    rule: string,
  ): void {
    if (evaluation.loanId.trim() !== borrower.loanId.trim()) {
      throw new Error(`Evaluation loan mismatch: expected ${borrower.loanId}, got ${evaluation.loanId}`);
    }

    if (evaluation.sessionId.trim() !== sessionId.trim()) {
      throw new Error(`Evaluation session mismatch: expected ${sessionId}, got ${evaluation.sessionId}`);
    }

    if (evaluation.rule !== null && evaluation.rule.trim().toUpperCase() !== rule.trim().toUpperCase()) {
      throw new Error(`Evaluation rule mismatch: expected ${rule}, got ${evaluation.rule}`);
    }
  }
}
