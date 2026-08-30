import type { Lender } from '../models/LenderData';
import { logger } from '../utils/Logger';

export class InvestmentService {
  static readonly MINIMUM_INVESTMENT_AMOUNT = 250;

  private totalInvestment = 0;

  constructor(private readonly lender: Lender) {}

  get remainingWallet(): number {
    return this.lender.walletAmount - this.totalInvestment;
  }

  get investedAmount(): number {
    return this.totalInvestment;
  }

  canFundAnotherInvestment(): boolean {
    return this.remainingWallet >= InvestmentService.MINIMUM_INVESTMENT_AMOUNT;
  }

  validateInvestmentAmount(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Invalid investment amount: ${amount}`);
    if (amount > this.remainingWallet) {
      throw new Error(`Wallet protection: ${amount} > remaining wallet ${this.remainingWallet}`);
    }
  }

  reserveAfterSuccessfulAddLoan(amount: number): void {
    this.validateInvestmentAmount(amount);
    this.totalInvestment += amount;
    logger.info(`Investment reserved: ₹${amount}; remaining wallet: ₹${this.remainingWallet}`);
  }
}
