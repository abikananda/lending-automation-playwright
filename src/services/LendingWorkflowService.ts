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
import { logger } from '../utils/Logger';
import { captureFailure } from '../utils/ScreenshotUtils';

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
            evaluated += 1;
            logger.info(
              `Evaluation loan=${evaluation.loanId} decision=${evaluation.decision} risk=${evaluation.riskLevel} amount=₹${evaluation.investmentAmount}`,
            );

            if (evaluation.decision.toUpperCase() !== 'INVEST') {
              skipped += 1;
              records.push({
                rule,
                loanId: borrower.loanId,
                borrowerName: borrower.name,
                status: 'SKIPPED',
                reason: evaluation.reason,
                evaluation,
              });
              await panel.close();
              continue;
            }

            investment.validateInvestmentAmount(evaluation.investmentAmount);
            await panel.setInvestmentAmount(evaluation.investmentAmount);
            await panel.addLoan();
            investment.reserveAfterSuccessfulAddLoan(evaluation.investmentAmount);
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
            const reason = error instanceof Error ? error.message : String(error);
            errors.push(`${rule}/${summary.name}: ${reason}`);
            records.push({ rule, borrowerName: summary.name, status: 'FAILED', reason });
            logger.error(`Borrower failed: ${summary.name}: ${reason}`);
            await captureFailure(this.page, `borrower-${summary.name}`);
            if (panel) await panel.close().catch(() => undefined);
          }
        }

        // Continue is a financial action; never retry it automatically.
        if (ruleInvested > 0) {
          await ui.clickContinue();
          await ui.validateSuccess();
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
}
