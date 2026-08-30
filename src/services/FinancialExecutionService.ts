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

    // Continue is a financial action. It is clicked once only. From this point onward,
    // any failure is treated as fatal because the request may already have reached the platform.
    await ui.clickContinue();
    try {
      await hooks.onContinueClicked?.();
      await ui.validateSuccess();
      await hooks.onPlatformConfirmed?.();
    } catch (error) {
      if (error instanceof UncertainFinancialStateError) throw error;
      throw new UncertainFinancialStateError(
        `Continue was clicked for rule ${rule}, but the post-click financial state could not be safely completed or confirmed. Workflow stopped to avoid a duplicate financial action.`,
        { cause: error },
      );
    }
  }
}
