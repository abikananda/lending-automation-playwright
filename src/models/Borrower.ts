export interface BorrowerSummary {
  loanId?: string;
  name?: string;
}

export interface Borrower {
  loanId: string;
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
  trusted?: boolean;
  name: string;
  lendingAmount?: number;
  riskCategory?: string;
  remainingAmount?: number;
  repaymentFrequency?: string;
  panelDetails?: Record<string, string>;
}
