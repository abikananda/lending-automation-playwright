export interface EvaluationResponse {
  loanId: string;
  sessionId: string;
  decision: string | null;
  riskLevel: string | null;
  investmentAmount: number;
  rule: string | null;
  reason: string | null;
  evaluationId: number;
}
