export interface EvaluationResponse {
  loanId: string;
  sessionId: string;
  decision: string | null;
  riskLevel: string | null;
  investmentAmount: number;
  rule: string | null;
  ruleVersion: string;
  rulesetVersion: string;
  engineVersion: string;
  reason: string | null;
  evaluationId: number | null;
}
