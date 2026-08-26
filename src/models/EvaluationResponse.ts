export interface EvaluationResponse {
  loanId: string;
  sessionId: string;
  decision: string;
  riskLevel: string;
  investmentAmount: number;
  rule: string;
  reason: string;
  evaluationId: number;
}
