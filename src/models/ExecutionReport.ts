import type { Borrower } from './Borrower';
import type { EvaluationResponse } from './EvaluationResponse';

export type BorrowerStatus = 'SELECTED' | 'FINALIZED' | 'SKIPPED' | 'FAILED' | 'UNCERTAIN';

export interface BorrowerExecutionRecord {
  rule: string;
  loanId?: string;
  borrowerName?: string;
  status: BorrowerStatus;
  reason?: string;
  evaluation?: EvaluationResponse;
  investmentAmount?: number;
}

export interface ExecutionReport {
  sessionId: string;
  lenderId: string;
  lenderName: string;
  initialWallet: number;
  finalWallet: number;
  totalBorrowers: number;
  evaluatedBorrowers: number;
  investedBorrowers: number;
  skippedBorrowers: number;
  failedBorrowers: number;
  totalInvestment: number;
  records: BorrowerExecutionRecord[];
  errors: string[];
}
