export interface Lender {
  lenderId: string;
  name: string;
  walletAmount: number;
  username: string;
  mobileNumber: string;
  otpUsername?: string;
  lendingRules: string[];
  active: boolean;
}

export interface LenderDataResponse {
  sessionId: string;
  lender: Lender;
  session: LendingSession;
}

export interface LendingSession {
  status: string;
  startedAt: string;
}
