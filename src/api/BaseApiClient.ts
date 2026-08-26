import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { config } from '../config/Config';
import { logger } from '../utils/Logger';
import { retryTransient } from '../utils/Retry';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class BaseApiClient {
  protected readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: config.backendUrl,
      timeout: config.apiTimeout,
      headers: { Accept: '*/*', 'Content-Type': 'application/json' },
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
      try {
        const response = await operation();
        return response.data;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const body = error.response?.data;
          const message = `Backend API request failed: ${status ?? 'NO_STATUS'} ${error.message}`;
          if (status && status >= 400 && status < 500) {
            throw new ApiError(message, status, body);
          }
          throw new ApiError(message, status, body);
        }
        throw error;
      }
    };

    if (allowRetry) return retryTransient(execute);
    return execute();
  }

  protected logApiFailure(error: unknown): void {
    if (error instanceof ApiError) {
      logger.error(`${error.message}${error.responseBody ? ` body=${JSON.stringify(error.responseBody)}` : ''}`);
    } else {
      logger.error(error instanceof Error ? error.message : String(error));
    }
  }
}
