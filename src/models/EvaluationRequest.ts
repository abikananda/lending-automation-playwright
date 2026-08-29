import type { Borrower } from './Borrower';

export interface EvaluationRequest {
  sessionId: string;
  loanId: string;
  borrowerName: string;
  creditScore: number;
  lendenScore: number;
  income: number;
  loanAmount: number;
  interestRate: number;
  tenure: number;
  emi: number;
  age: number;
  borrowerType: string;
  repeated: boolean;
  riskCategory?: string;
  remainingAmount?: number;
  repaymentFrequency?: string;
  panelDetails?: Record<string, string>;
}

export function toEvaluationRequest(sessionId: string, borrower: Borrower): EvaluationRequest {
  return {
    sessionId,
    loanId: borrower.loanId,
    borrowerName: borrower.name,
    creditScore: borrower.creditScore,
    lendenScore: borrower.lendenScore,
    income: borrower.income,
    loanAmount: borrower.loanAmount,
    interestRate: borrower.interestRate,
    tenure: borrower.tenure,
    emi: borrower.emi,
    age: borrower.age,
    borrowerType: borrower.borrowerType,
    repeated: borrower.repeated,
    riskCategory: borrower.riskCategory,
    remainingAmount: borrower.remainingAmount,
    repaymentFrequency: borrower.repaymentFrequency,
    panelDetails: borrower.panelDetails,
  };
}
