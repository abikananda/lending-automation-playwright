import { z } from 'zod';
import { config } from '../config/Config';
import type { NpaBorrower } from '../models/NpaBorrower';
import { BaseApiClient } from './BaseApiClient';

const npaBorrowerSchema = z.object({
  id: z.coerce.number().int().positive(),
  borrowerName: z.string().min(1),
  normalizedName: z.string().min(1),
  hitCount: z.coerce.number().int().nonnegative(),
});

const npaBorrowersSchema = z.array(npaBorrowerSchema);

export class NpaBorrowerApiClient extends BaseApiClient {
  async getActiveBorrowers(): Promise<NpaBorrower[]> {
    const path = config.npaBorrowerPath;
    this.logApiRequest('GET', path, 'NPA_BORROWER_LIST');
    const data = await this.get<unknown>(path);
    const result = npaBorrowersSchema.parse(data) as NpaBorrower[];
    this.logApiSuccess('NPA_BORROWER_LIST', `count=${result.length}`);
    return result;
  }

  async recordHit(id: number, sessionId: string, loanId: string): Promise<void> {
    const path = `${config.npaBorrowerPath}/${id}/hit`;
    this.logApiRequest('POST', path, 'NPA_BORROWER_HIT');
    await this.post<unknown>(path, { sessionId, loanId });
    this.logApiSuccess('NPA_BORROWER_HIT', `id=${id} sessionId=${sessionId} loanId=${loanId}`);
  }
}
