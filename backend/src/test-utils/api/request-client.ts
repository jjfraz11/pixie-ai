/**
 * HTTP request utilities for API testing
 */

/**
 * Request options for API calls
 */
export interface RequestOptions {
  headers?: { [key: string]: string };
  timeout?: number;
}

/**
 * Helper function to make authenticated requests
 */
export async function makeAuthenticatedRequest(
  method: string,
  url: string,
  token?: string,
  data?: any,
): Promise<Response> {
  const headers: { [key: string]: string } = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Helper function to make API requests with consistent error handling
 * Returns an object with either 'data' for success or 'errors' array for failures
 */
export async function makeApiRequest(
  port: number,
  endpoint: string,
  body?: any,
  options: RequestOptions = {},
): Promise<ApiResponse> {
  const { headers = {}, timeout = 5000 } = options;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`http://localhost:${port}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return await handleResponse(response);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { errors: [`Request timeout after ${timeout}ms`], status: 500 };
    }

    return { errors: [`Network error: ${error.message}`], status: 500 };
  }
}

/**
 * Helper function to make authenticated API requests
 */
export async function makeAuthenticatedApiRequest(
  port: number,
  endpoint: string,
  token: string,
  body?: any,
  options: RequestOptions = {},
): Promise<ApiResponse> {
  return makeApiRequest(port, endpoint, body, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * API response wrapper that handles both success and error cases
 */
export interface ApiResponse {
  data?: any;
  errors?: string[];
  status?: number;
}

/**
 * Handle different response scenarios and return consistent format
 */
async function handleResponse(response: Response): Promise<ApiResponse> {
  const { status } = response;

  try {
    const text = await response.text();
    let data;

    // Handle empty responses
    if (!text.trim()) {
      data = null;
    } else {
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        return {
          errors: [`Invalid JSON response: ${text.substring(0, 100)}...`],
          status,
        };
      }
    }

    // Handle error status codes
    if (status >= 400) {
      const errorMessages: string[] = [];

      if (data && typeof data === 'object') {
        // Handle structured error responses
        if (data.message) {
          errorMessages.push(`${status}: ${data.message}`);
        } else if (data.error) {
          errorMessages.push(`${status}: ${data.error}`);
        } else if (data.code && data.message) {
          errorMessages.push(`${data.code}: ${data.message}`);
        } else {
          errorMessages.push(`${status}: ${JSON.stringify(data)}`);
        }
      } else {
        errorMessages.push(`${status}: ${text || 'Unknown error'}`);
      }

      return { errors: errorMessages, status };
    }

    // Success response
    return { data, status };
  } catch (error: any) {
    return {
      errors: [`Failed to process response: ${error.message}`],
      status,
    };
  }
}
