import axios, { type AxiosResponse } from 'axios';
import { Cache } from '../core/cache.js';
import { DEFAULT_CACHE_TTL, DEFAULT_CACHE_DIR, DEFAULT_REQUEST_TIMEOUT } from '../core/constants.js';

export interface ServiceResponse<T> {
  data: T;
  headers: any;
}

/**
 * BaseService provides common functionality for external integrations
 */
export class BaseService {
  protected serviceName: string;
  protected cache: Cache;
  protected userAgent: string;

  constructor(serviceName: string, cacheTTL: number = DEFAULT_CACHE_TTL) {
    this.serviceName = serviceName;
    this.cache = new Cache(DEFAULT_CACHE_DIR, cacheTTL);
    this.userAgent = serviceName;
  }

  async getCached<T>(
    url: string,
    headers: any = {},
    timeout: number = DEFAULT_REQUEST_TIMEOUT,
  ): Promise<ServiceResponse<T> | null> {
    const cached = await this.cache.get<ServiceResponse<T>>(url);
    if (cached) {
      return cached;
    }

    try {
      const response: AxiosResponse<T> = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          ...headers,
        },
        timeout,
      });

      const result: ServiceResponse<T> = {
        data: response.data,
        headers: response.headers,
      };

      await this.cache.set(url, result);
      return result;
    } catch (error: any) {
      this.handleError(url, error);
      return null;
    }
  }

  protected handleError(url: string, error: any): void {
    if (error.response?.status === 404) {
      console.warn(`⚠️ [${this.serviceName}] Resource not found: ${url}`);
    } else if (error.response?.status === 403) {
      console.warn(`⚠️ [${this.serviceName}] Rate limit exceeded for ${url}`);
    } else {
      console.warn(`⚠️ [${this.serviceName}] Failed to fetch ${url}: ${error.message}`);
    }
  }
}
