import { z } from 'zod';
import { config } from '../config/Config';
import { BaseApiClient } from './BaseApiClient';

const healthSchema = z.object({
  status: z.string(),
});

export class HealthApiClient extends BaseApiClient {
  async assertHealthy(): Promise<void> {
    this.logApiRequest('GET', config.backendHealthPath, 'BACKEND_HEALTH');
    const data = await this.get<unknown>(config.backendHealthPath);
    const health = healthSchema.parse(data);

    if (health.status.toUpperCase() !== 'UP') {
      throw new Error(`Backend health check failed with status=${health.status}`);
    }

    this.logApiSuccess('BACKEND_HEALTH', `status=${health.status}`);
  }
}
