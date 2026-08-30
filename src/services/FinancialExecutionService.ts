import { UncertainFinancialStateError } from '../errors/UncertainFinancialStateError';
import type { BorrowerPanel } from '../pages/BorrowerPanel';
import type { ManualLendingPage } from '../pages/ManualLendingPage';

export interface RuleFinalizationHooks {
  onContinueClicked?: () => Promise<void>;
  onPlatformConfirmed?: () => Promise<void>;
}

export class FinancialExecutionService {
  async addLoan(panel: BorrowerPanel): Promise<void> {
    await panel.addLoan();
  }

  async finalizeRule(
    ui: ManualLendingPage,
    rule: string,
    investmentAmount: number,
    hooks: RuleFinalizationHooks = {},
  ): Promise<void> {
    await ui.setInvestmentAmount(investmentAmount);

    // Continue is a financial action. It is clicked once only. Any ambiguity after
    // the click is fatal because retrying could duplicate lending.
    await ui.clickContinue();
    await hooks.onContinueClicked?.();
    try {
      await ui.validateSuccess();
    } catch (error) {
      throw new UncertainFinancialStateError(
        `Continue was clicked for rule ${rule}, but lending success could not be confirmed. Workflow stopped to avoid a duplicate financial action.`,
        { cause: error },
      );
    }
    await hooks.onPlatformConfirmed?.();
  }
}
