import type { LenderApiClient, WorkflowCheckpointState } from '../api/LenderApiClient';

export class WorkflowCheckpointService {
  constructor(private readonly lenderApi: LenderApiClient) {}

  async record(
    sessionId: string,
    state: WorkflowCheckpointState,
    details: { loanId?: string; rule?: string; message?: string } = {},
  ): Promise<void> {
    await this.lenderApi.checkpoint(sessionId, state, details);
  }
}
