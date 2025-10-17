import { ApiResponse, RequestOptions } from './request-client';

/**
 * Retry configuration options
 */
export interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableStatusCodes?: number[];
  retryableErrors?: string[];
}

/**
 * Request timing and performance data
 */
export interface RequestMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  retryCount: number;
  totalBytes?: number;
}

/**
 * Enhanced error context with debugging information
 */
export interface EnhancedErrorContext {
  error: Error;
  requestId: string;
  endpoint: string;
  method: string;
  statusCode?: number;
  retryCount: number;
  totalDuration: number;
  metrics: RequestMetrics;
  debugInfo?: {
    stackTrace?: string;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    requestBody?: any;
    responseBody?: any;
  };
}

/**
 * Response validator function type
 */
export type ResponseValidator<T = any> = (response: ApiResponse) => response is ApiResponse & { data: T };

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'],
};

/**
 * Default request timeout
 */
const DEFAULT_TIMEOUT = 10000; // 10 seconds

/**
 * Enhanced API client with retry logic and comprehensive error handling
 */
export class EnhancedApiClient {
  private requestCounter = 0;

  /**
   * Generate a unique request ID for tracking
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestCounter}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number, config: RetryConfig): number {
    const { baseDelay = 1000, maxDelay = 30000, backoffMultiplier = 2 } = config;

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 + 0.95; // 0.95 to 1.05 multiplier
    const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt) * jitter, maxDelay);

    return Math.floor(delay);
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any, statusCode: number | undefined, config: RetryConfig): boolean {
    // Check status codes
    if (statusCode && config.retryableStatusCodes?.includes(statusCode)) {
      return true;
    }

    // Check error types
    if (error && config.retryableErrors) {
      const errorMessage = error.message || error.toString();
      return config.retryableErrors.some((retryableError) => errorMessage.includes(retryableError));
    }

    return false;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Make a reliable API request with retry logic and enhanced error handling
   */
  async makeReliableApiRequest(
    port: number,
    endpoint: string,
    body?: any,
    options: RequestOptions & { retryConfig?: RetryConfig } = {},
  ): Promise<ApiResponse & { metrics: RequestMetrics; requestId: string }> {
    const { retryConfig = {}, timeout = DEFAULT_TIMEOUT, ...requestOptions } = options;

    const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    const requestId = this.generateRequestId();
    const metrics: RequestMetrics = {
      startTime: Date.now(),
      retryCount: 0,
    };

    let lastError: any;
    let lastStatusCode: number | undefined;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        metrics.retryCount = attempt;

        // Import the original makeApiRequest function dynamically to avoid circular imports
        const { makeApiRequest } = await import('./request-client');

        const response = await makeApiRequest(port, endpoint, body, {
          ...requestOptions,
          timeout,
        });

        metrics.endTime = Date.now();
        metrics.duration = metrics.endTime - metrics.startTime;

        // Success - no need to retry
        if (response.data || (!response.errors && response.status && response.status < 400)) {
          return {
            ...response,
            metrics,
            requestId,
          };
        }

        // Check if this error is retryable
        lastError = response.errors?.[0] || 'Unknown error';
        lastStatusCode = response.status;

        if (!this.isRetryableError(lastError, lastStatusCode, config)) {
          break;
        }

        // If this is the last attempt, don't wait
        if (attempt === config.maxRetries) {
          break;
        }

        // Wait before retrying
        const delay = this.calculateBackoffDelay(attempt, config);
        console.log(
          `Request ${requestId} attempt ${attempt + 1} failed (${lastStatusCode}), retrying in ${delay}ms...`,
        );
        await this.sleep(delay);
      } catch (error: any) {
        lastError = error;
        lastStatusCode = undefined;

        if (!this.isRetryableError(error, undefined, config)) {
          break;
        }

        if (attempt === config.maxRetries) {
          break;
        }

        const delay = this.calculateBackoffDelay(attempt, config);
        console.log(`Request ${requestId} attempt ${attempt + 1} failed (${error.message}), retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    // All retries exhausted - return error response
    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;

    const errorResponse: ApiResponse = {
      errors: [`Request failed after ${config.maxRetries + 1} attempts. Last error: ${lastError}`],
      status: lastStatusCode || 500,
    };

    return {
      ...errorResponse,
      metrics,
      requestId,
    };
  }

  /**
   * Make a reliable authenticated API request
   */
  async makeAuthenticatedReliableRequest(
    port: number,
    endpoint: string,
    token: string,
    body?: any,
    options: RequestOptions & { retryConfig?: RetryConfig } = {},
  ): Promise<ApiResponse & { metrics: RequestMetrics; requestId: string }> {
    return this.makeReliableApiRequest(port, endpoint, body, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  }

  /**
   * Make multiple reliable requests in parallel with enhanced error handling
   */
  async makeBulkReliableRequests(
    requests: Array<{
      port: number;
      endpoint: string;
      body?: any;
      token?: string;
      options?: RequestOptions & { retryConfig?: RetryConfig };
    }>,
  ): Promise<Array<ApiResponse & { metrics: RequestMetrics; requestId: string }>> {
    const promises = requests.map((req) => {
      if (req.token) {
        return this.makeAuthenticatedReliableRequest(req.port, req.endpoint, req.token, req.body, req.options);
      } else {
        return this.makeReliableApiRequest(req.port, req.endpoint, req.body, req.options);
      }
    });

    return Promise.all(promises);
  }

  /**
   * Make a request with custom response validation
   */
  async makeReliableRequestWithValidation<T>(
    port: number,
    endpoint: string,
    validator: ResponseValidator<T>,
    body?: any,
    options: RequestOptions & { retryConfig?: RetryConfig } = {},
  ): Promise<(ApiResponse & { data: T; metrics: RequestMetrics; requestId: string }) | null> {
    const response = await this.makeReliableApiRequest(port, endpoint, body, options);

    if (validator(response)) {
      return response as ApiResponse & { data: T; metrics: RequestMetrics; requestId: string };
    }

    return null;
  }

  /**
   * Create enhanced error context for debugging
   */
  createEnhancedErrorContext(
    error: Error,
    endpoint: string,
    method: string,
    metrics: RequestMetrics,
    additionalInfo?: {
      statusCode?: number;
      requestHeaders?: Record<string, string>;
      responseHeaders?: Record<string, string>;
      requestBody?: any;
      responseBody?: any;
    },
  ): EnhancedErrorContext {
    return {
      error,
      requestId: this.generateRequestId(),
      endpoint,
      method,
      statusCode: additionalInfo?.statusCode,
      retryCount: metrics.retryCount,
      totalDuration: metrics.duration || 0,
      metrics,
      debugInfo: {
        stackTrace: error.stack,
        requestHeaders: additionalInfo?.requestHeaders,
        responseHeaders: additionalInfo?.responseHeaders,
        requestBody: additionalInfo?.requestBody,
        responseBody: additionalInfo?.responseBody,
      },
    };
  }

  /**
   * Log enhanced error with full context
   */
  logEnhancedError(context: EnhancedErrorContext): void {
    console.error(`[EnhancedApiClient] Request failed: ${context.endpoint}`, {
      requestId: context.requestId,
      method: context.method,
      statusCode: context.statusCode,
      retryCount: context.retryCount,
      duration: context.totalDuration,
      error: context.error.message,
      stackTrace: context.debugInfo?.stackTrace,
      metrics: context.metrics,
      debugInfo: context.debugInfo,
    });
  }
}

/**
 * Global enhanced API client instance
 */
export const enhancedApiClient = new EnhancedApiClient();

// Convenience functions for easy usage
export async function makeReliableApiRequest(
  port: number,
  endpoint: string,
  body?: any,
  options?: RequestOptions & { retryConfig?: RetryConfig },
): Promise<ApiResponse & { metrics: RequestMetrics; requestId: string }> {
  return enhancedApiClient.makeReliableApiRequest(port, endpoint, body, options);
}

export async function makeAuthenticatedReliableRequest(
  port: number,
  endpoint: string,
  token: string,
  body?: any,
  options?: RequestOptions & { retryConfig?: RetryConfig },
): Promise<ApiResponse & { metrics: RequestMetrics; requestId: string }> {
  return enhancedApiClient.makeAuthenticatedReliableRequest(port, endpoint, token, body, options);
}

export async function makeBulkReliableRequests(
  requests: Array<{
    port: number;
    endpoint: string;
    body?: any;
    token?: string;
    options?: RequestOptions & { retryConfig?: RetryConfig };
  }>,
): Promise<Array<ApiResponse & { metrics: RequestMetrics; requestId: string }>> {
  return enhancedApiClient.makeBulkReliableRequests(requests);
}

export async function makeReliableRequestWithValidation<T>(
  port: number,
  endpoint: string,
  validator: ResponseValidator<T>,
  body?: any,
  options?: RequestOptions & { retryConfig?: RetryConfig },
): Promise<(ApiResponse & { data: T; metrics: RequestMetrics; requestId: string }) | null> {
  return enhancedApiClient.makeReliableRequestWithValidation(port, endpoint, validator, body, options);
}
