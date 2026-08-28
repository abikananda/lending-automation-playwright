import { randomUUID } from 'node:crypto';
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { config } from '../config/Config';
import { logger } from '../utils/Logger';
import { retryTransient } from '../utils/Retry';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly responseBody?: unknown,
    public readonly method?: string,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class BaseApiClient {
  protected readonly http: AxiosInstance;

  constructor() {
    const headers: Record<string, string> = {
      Accept: '*/*',
      'Content-Type': 'application/json',
    };

    if (config.backendApiKey) {
      headers[config.backendAuthHeader] = config.backendApiKey;
    }

    this.http = axios.create({
      baseURL: config.backendUrl,
      timeout: config.apiTimeout,
      headers,
    });

    this.http.interceptors.request.use((request) => {
      if (!request.headers.get('X-Correlation-Id')) {
        request.headers.set('X-Correlation-Id', `PW-${randomUUID()}`);
      }
      return request;
    });
  }

  protected async get<T>(path: string, options?: AxiosRequestConfig): Promise<T> {
    return this.request<T>(() => this.http.get<T>(path, options), true);
  }

  protected async post<T>(path: string, body: unknown, options?: AxiosRequestConfig): Promise<T> {
    return this.request<T>(() => this.http.post<T>(path, body, options), true);
  }

  protected async postFinancial<T>(path: string, body: unknown, options?: AxiosRequestConfig): Promise<T> {
    return this.request<T>(() => this.http.post<T>(path, body, options), false);
  }

  private async request<T>(
    operation: () => Promise<AxiosResponse<T>>,
    allowRetry: boolean,
  ): Promise<T> {
    const execute = async (): Promise<T> => {
      const startedAt = Date.now();
      try {
        const response = await operation();
        const correlationId = response.headers['x-correlation-id'];
        logger.info(
          `API RESPONSE method=${response.config.method?.toUpperCase() ?? 'UNKNOWN'} url=${response.config.url ?? 'UNKNOWN'} status=${response.status} durationMs=${Date.now() - startedAt}${correlationId ? ` correlationId=${correlationId}` : ''}`,
        );
        return response.data;
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const body = error.response?.data;
          const method = error.config?.method?.toUpperCase();
          const correlationId = error.response?.headers?.['x-correlation-id'] as string | undefined;
          logger.error(
            `API ERROR method=${method ?? 'UNKNOWN'} url=${error.config?.url ?? 'UNKNOWN'} status=${status ?? 'NO_STATUS'} durationMs=${durationMs} message=${error.message}${correlationId ? ` correlationId=${correlationId}` : ''}`,
          );
          const message = `Backend API request failed: ${status ?? 'NO_STATUS'} ${error.message}`;
          throw new ApiError(message, status, body, method, correlationId);
        }
        logger.error(`API ERROR status=NO_STATUS durationMs=${durationMs} message=${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    };

    if (allowRetry) return retryTransient(execute, 3, [500, 1000, 2000], (error) => this.isRetryable(error));
    return execute();
  }

  private isRetryable(error: unknown): boolean {
    if (!(error instanceof ApiError)) return false;

    // GET requests are safe to retry. POST requests may have succeeded server-side
    // even when the response was lost, so they are deliberately not retried.
    if (error.method !== 'GET') return false;

    if (!error.status) return true;
    return [408, 429, 500, 502, 503, 504].includes(error.status);
  }

  protected logApiRequest(method: string, path: string, operation: string): void {
    logger.info(`API CALL operation=${operation} method=${method} path=${path}`);
  }

  protected logApiSuccess(operation: string, details?: string): void {
    logger.info(`API SUCCESS operation=${operation}${details ? ` ${details}` : ''}`);
  }

  protected logApiFailure(error: unknown): void {
    if (error instanceof ApiError) {
      logger.error(
        `${error.message}${error.correlationId ? ` correlationId=${error.correlationId}` : ''}${error.responseBody ? ` body=${JSON.stringify(error.responseBody)}` : ''}`,
      );
    } else {
      logger.error(error instanceof Error ? error.message : String(error));
    }
  }
}
