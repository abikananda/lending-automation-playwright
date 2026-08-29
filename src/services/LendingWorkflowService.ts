import type { Page } from '@playwright/test';
import { ApiError } from '../api/BaseApiClient';
import { EvaluationApiClient } from '../api/EvaluationApiClient';
import { HealthApiClient } from '../api/HealthApiClient';
import { LenderApiClient } from '../api/LenderApiClient';
import { NpaBorrowerApiClient } from '../api/NpaBorrowerApiClient';
import { PersistenceApiClient } from '../api/PersistenceApiClient';
import { config } from '../config/Config';
import type { Borrower } from '../models/Borrower';
import type { EvaluationResponse } from '../models/EvaluationResponse';
import type { BorrowerExecutionRecord, ExecutionReport } from '../models/ExecutionReport';
import type { NpaBorrower } from '../models/NpaBorrower';
import { ManualLendingPage } from '../pages/ManualLendingPage';
import { captureFailure } from '../utils/ScreenshotUtils';
import { logger } from '../utils/Logger';
import { BorrowerService } from './BorrowerService';
import { InvestmentService } from './InvestmentService';
import { LendingRuleService } from './LendingRuleService';
import { PersistenceService } from './PersistenceService';

class UncertainFinancialStateError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'UncertainFinancialStateError';
  }
}

export class LendingWorkflowService {
  private readonly healthApi = new HealthApiClient();
  private readonly lenderApi = new LenderApiClient();
  private readonly evaluationApi = new EvaluationApiClient();
  private readonly npaBorrowerApi = new NpaBorrowerApiClient();
  private readonly persistenceApi = new PersistenceApiClient();
  private readonly ruleService = new LendingRuleService();
  private readonly persistenceService = new PersistenceService(this.persistenceApi);

  constructor(private readonly page: Page) {}

  async execute(): Promise<void> {
    logger.info('Starting lending workflow');
    await this.healthApi.assertHealthy();

    const lenderData = await this.lenderApi.getLenderData();
    if (!lenderData.lender.active) throw new Error('Lender is inactive; stopping workflow');

    logger.info(`Session: ${lenderData.sessionId}`);
    logger.info(`Lender: ${lenderData.lender.name}`);
    logger.info(`Wallet: ₹${lenderData.lender.walletAmount}`);
    logger.info(`Rules: ${JSON.stringify(lenderData.lender.lendingRules)}`);
    await this.persistenceService.session(lenderData);

    const npaBorrowers = await this.npaBorrowerApi.getActiveBorrowers();
    const npaBorrowersByName = new Map<string, NpaBorrower>(
      npaBorrowers.map((borrower) => [this.normalizeBorrowerName(borrower.borrowerName), borrower]),
    );
    logger.info(`Loaded ${npaBorrowersByName.size} active NPA borrower(s) for this run`);

    await this.ensureReusableAuthenticatedSession();

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
        let ruleInvestmentAmount: number | undefined;
        let ruleParsedBorrowers = 0;

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
            ruleParsedBorrowers += 1;
            logger.info(`Borrower ${ruleParsedBorrowers} fetched data for ${rule}: ${borrower.name} (${borrower.loanId})`);

            const evaluation = await borrowerService.evaluate(lenderData.sessionId, rule, borrower);
            this.validateEvaluationIdentity(evaluation, borrower, lenderData.sessionId, rule);
            evaluated += 1;

            if (evaluation.decision === null || evaluation.decision.toUpperCase() !== 'INVEST') {
              skipped += 1;
              records.push({
                rule,
                loanId: borrower.loanId,
                borrowerName: borrower.name,
                status: 'SKIPPED',
                reason: evaluation.reason ?? 'Evaluation did not select borrower for investment',
                evaluation,
              });
              await panel.close();
              continue;
            }

            const npaBorrower = npaBorrowersByName.get(this.normalizeBorrowerName(borrower.name));
            if (npaBorrower) {
              skipped += 1;
              const reason = `NPA borrower matched; investment blocked (NPA id=${npaBorrower.id})`;
              logger.warn(`NPA BLOCK borrower=${borrower.name} loanId=${borrower.loanId} npaId=${npaBorrower.id}`);
              try {
                await this.npaBorrowerApi.recordHit(npaBorrower.id, lenderData.sessionId, borrower.loanId);
              } catch (error) {
                logger.error(`NPA borrower was blocked but hit-count update failed npaId=${npaBorrower.id} loanId=${borrower.loanId}: ${error instanceof Error ? error.message : String(error)}`);
              }
              records.push({ rule, loanId: borrower.loanId, borrowerName: borrower.name, status: 'SKIPPED', reason, evaluation });
              await panel.close();
              continue;
            }

            if (selectedLoanIds.has(borrower.loanId)) {
              skipped += 1;
              const reason = 'Loan already selected earlier in this workflow; duplicate investment prevented';
              logger.warn(`Skipping duplicate investment loanId=${borrower.loanId} rule=${rule}`);
              records.push({ rule, loanId: borrower.loanId, borrowerName: borrower.name, status: 'SKIPPED', reason, evaluation });
              await panel.close();
              continue;
            }

            if (ruleInvestmentAmount !== undefined && ruleInvestmentAmount !== evaluation.investmentAmount) {
              throw new Error(`Inconsistent investment amount for rule ${rule}: expected ₹${ruleInvestmentAmount}, got ₹${evaluation.investmentAmount} for loan ${borrower.loanId}`);
            }

            investment.validateInvestmentAmount(evaluation.investmentAmount);
            await panel.addLoan();

            if (ruleInvestmentAmount === undefined) {
              ruleInvestmentAmount = evaluation.investmentAmount;
              logger.info(`Rule ${rule} investment amount established at ₹${ruleInvestmentAmount}`);
            }

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
            if (this.isRuleEvaluationFailure(error)) {
              skipped += 1;
              const reason = this.ruleEvaluationFailureReason(error);
              records.push({ rule, borrowerName: summary.name, status: 'SKIPPED', reason });
              logger.warn(`Skipping borrower after backend rule failure: ${summary.name}: ${reason}`);
              if (panel) await panel.close().catch(() => undefined);
              continue;
            }

            failed += 1;
            ruleBorrowerFailures += 1;
            const reason = error instanceof Error ? error.message : String(error);
            errors.push(`${rule}/${summary.name}: ${reason}`);
            records.push({ rule, borrowerName: summary.name, status: 'FAILED', reason });
            logger.error(`Borrower failed: ${summary.name}: ${reason}`);
            if (panel) await panel.close().catch(() => undefined);
          }
        }

        logger.info(`Finished parsing borrowers for ${rule}: ${ruleParsedBorrowers} borrower(s) fetched successfully`);

        if (ruleBorrowerFailures > 0) {
          logger.error(`Rule ${rule} completed with ${ruleBorrowerFailures} borrower failure(s)`);
          await captureFailure(this.page, `rule-${rule}-borrowers`);
        }

        if (ruleInvested > 0) {
          if (ruleInvestmentAmount === undefined) throw new Error(`Missing investment amount for rule ${rule} despite ${ruleInvested} selected loan(s)`);
          await ui.setInvestmentAmount(ruleInvestmentAmount);
          await ui.clickContinue();
          try {
            await ui.validateSuccess();
          } catch (error) {
            throw new UncertainFinancialStateError(`Continue was clicked for rule ${rule}, but lending success could not be confirmed. Workflow stopped to avoid a duplicate financial action.`, { cause: error });
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
        if (error instanceof UncertainFinancialStateError) throw error;
        try {
          await ui.closeOpenModalIfPresent();
        } catch (cleanupError) {
          logger.warn(`UI cleanup failed after rule ${rule}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
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

    try {
      await this.lenderApi.completeSession(lenderData.sessionId);
    } catch (error) {
      logger.error(`Workflow finished but backend session completion failed for ${lenderData.sessionId}: ${error instanceof Error ? error.message : String(error)}`);
    }

    logger.info(`Workflow complete. Total investment: ₹${report.totalInvestment}`);
  }

  private normalizeBorrowerName(name: string): string {
    return name.trim().toLowerCase();
  }

  private async ensureReusableAuthenticatedSession(): Promise<void> {
    await this.page.goto(`${config.lendenClubUrl}/manual-lending`, { waitUntil: 'domcontentloaded' });
    const currentUrl = this.page.url();
    const redirectedToLogin = /\/login(?:[/?#]|$)/i.test(currentUrl);
    const loginUiVisible = await this.page.locator('#otp, input[type="tel"]').first().isVisible().catch(() => false);

    if (redirectedToLogin || loginUiVisible) {
      throw new Error(`Saved LenDenClub session for username ${config.username} is missing or expired. Run: $env:LENDER_USERNAME='${config.username}'; npm run auth`);
    }

    logger.info(`Reused saved LenDenClub authenticated session for username=${config.username}`);
  }

  private isRuleEvaluationFailure(error: unknown): error is ApiError {
    if (!(error instanceof ApiError) || error.status !== 422 || typeof error.responseBody !== 'object' || error.responseBody === null) return false;
    return (error.responseBody as { error?: unknown }).error === 'RULE_EVALUATION_FAILED';
  }

  private ruleEvaluationFailureReason(error: ApiError): string {
    if (typeof error.responseBody === 'object' && error.responseBody !== null) {
      const body = error.responseBody as { message?: unknown; correlationId?: unknown };
      const message = typeof body.message === 'string' ? body.message : error.message;
      const correlationId = typeof body.correlationId === 'string' ? ` correlationId=${body.correlationId}` : '';
      return `${message}${correlationId}`;
    }
    return error.message;
  }

  private validateEvaluationIdentity(evaluation: EvaluationResponse, borrower: Borrower, sessionId: string, rule: string): void {
    if (evaluation.loanId.trim() !== borrower.loanId.trim()) throw new Error(`Evaluation loan mismatch: expected ${borrower.loanId}, got ${evaluation.loanId}`);
    if (evaluation.sessionId.trim() !== sessionId.trim()) throw new Error(`Evaluation session mismatch: expected ${sessionId}, got ${evaluation.sessionId}`);
    if (evaluation.rule !== null && evaluation.rule.trim().toUpperCase() !== rule.trim().toUpperCase()) {
      throw new Error(`Evaluation rule mismatch: expected ${rule}, got ${evaluation.rule}`);
    }
  }
}
