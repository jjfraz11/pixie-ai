import { describe, it, beforeEach, afterEach } from 'mocha';
import assert from 'assert';
import {
  makeApiRequest,
  makeAuthenticatedApiRequest,
  makeAuthenticatedRequest,
  getAuthToken,
  ApiResponse,
  RequestOptions,
} from '../index';

describe('API Helpers', () => {
  let port: number;

  beforeEach(() => {
    port = 3000; // Mock port for testing
  });

  describe('makeApiRequest', () => {
    it('should make successful POST request', async () => {
      // Mock fetch for successful response
      global.fetch = async () =>
        ({
          status: 200,
          text: async () => JSON.stringify({ data: 'success' }),
        } as Response);

      const response = await makeApiRequest(port, '/test', { key: 'value' });

      assert.strictEqual(response.status, 200);
      assert.ok(response.data);
    });

    it('should handle timeout', async () => {
      // Mock fetch to never resolve and properly handle AbortController
      global.fetch = async (url: any, options: any) => {
        // Check if AbortController is present and abort after timeout
        if (options.signal) {
          return new Promise((resolve, reject) => {
            options.signal.addEventListener('abort', () => {
              const error = new Error('Request timeout');
              (error as any).name = 'AbortError';
              reject(error);
            });
          });
        }
        return new Promise(() => {}); // Never resolves if no abort signal
      };

      const response = await makeApiRequest(port, '/test', {}, { timeout: 100 });

      assert.ok(response.errors);
      assert.ok(response.errors[0].includes('timeout'));
    });

    it('should handle network errors', async () => {
      // Mock fetch to throw network error
      global.fetch = async () => {
        throw new Error('Network error');
      };

      const response = await makeApiRequest(port, '/test');

      assert.ok(response.errors);
      assert.ok(response.errors[0].includes('Network error'));
    });

    it('should handle empty response', async () => {
      // Mock fetch with empty response
      global.fetch = async () =>
        ({
          status: 200,
          text: async () => '',
        } as Response);

      const response = await makeApiRequest(port, '/test');

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data, null);
    });

    it('should handle invalid JSON response', async () => {
      // Mock fetch with invalid JSON
      global.fetch = async () =>
        ({
          status: 200,
          text: async () => 'invalid json',
        } as Response);

      const response = await makeApiRequest(port, '/test');

      assert.ok(response.errors);
      assert.ok(response.errors[0].includes('Invalid JSON'));
    });

    it('should handle error status codes', async () => {
      // Mock fetch with error response
      global.fetch = async () =>
        ({
          status: 400,
          text: async () => JSON.stringify({ message: 'Bad request' }),
        } as Response);

      const response = await makeApiRequest(port, '/test');

      assert.strictEqual(response.status, 400);
      assert.ok(response.errors);
      assert.ok(response.errors[0].includes('400'));
    });

    it('should include custom headers', async () => {
      // Mock fetch to capture headers
      let capturedHeaders: any = {};
      global.fetch = async (url: any, options: any) => {
        capturedHeaders = options.headers;
        return {
          status: 200,
          text: async () => JSON.stringify({ data: 'success' }),
        } as Response;
      };

      await makeApiRequest(
        port,
        '/test',
        {},
        {
          headers: { 'Custom-Header': 'test-value' },
        },
      );

      assert.strictEqual(capturedHeaders['Custom-Header'], 'test-value');
      assert.strictEqual(capturedHeaders['Content-Type'], 'application/json');
    });
  });

  describe('makeAuthenticatedApiRequest', () => {
    it('should add authorization header', async () => {
      let capturedHeaders: any = {};
      global.fetch = async (url: any, options: any) => {
        capturedHeaders = options.headers;
        return {
          status: 200,
          text: async () => JSON.stringify({ data: 'success' }),
        } as Response;
      };

      const token = 'test-token';
      await makeAuthenticatedApiRequest(port, '/test', token);

      assert.strictEqual(capturedHeaders.Authorization, `Bearer ${token}`);
    });

    it('should handle request body', async () => {
      let capturedBody: any;
      global.fetch = async (url: any, options: any) => {
        capturedBody = options.body;
        return {
          status: 200,
          text: async () => JSON.stringify({ data: 'success' }),
        } as Response;
      };

      const body = { key: 'value' };
      await makeAuthenticatedApiRequest(port, '/test', 'token', body);

      assert.ok(capturedBody);
      assert.deepStrictEqual(JSON.parse(capturedBody), body);
    });
  });

  describe('makeAuthenticatedRequest', () => {
    it('should make authenticated request with token', async () => {
      // Mock fetch for authenticated request
      global.fetch = async () =>
        ({
          status: 200,
          text: async () => JSON.stringify({ data: 'authenticated' }),
        } as Response);

      const response = await makeAuthenticatedRequest('GET', 'http://localhost:3000/test', 'test-token');

      assert.ok(response);
    });

    it('should handle request without token', async () => {
      global.fetch = async () =>
        ({
          status: 200,
          text: async () => JSON.stringify({ data: 'no-auth' }),
        } as Response);

      const response = await makeAuthenticatedRequest('GET', 'http://localhost:3000/test');

      assert.ok(response);
    });

    it('should include request body', async () => {
      let capturedBody: any;
      global.fetch = async (url: any, options: any) => {
        capturedBody = options.body;
        return {
          status: 200,
          text: async () => JSON.stringify({ data: 'success' }),
        } as Response;
      };

      const data = { key: 'value' };
      await makeAuthenticatedRequest('POST', 'http://localhost:3000/test', 'token', data);

      assert.ok(capturedBody);
      assert.deepStrictEqual(JSON.parse(capturedBody), data);
    });
  });

  describe('getAuthToken', () => {
    it('should get authentication token successfully', async () => {
      // Mock fetch for authentication
      global.fetch = async () =>
        ({
          status: 201,
          text: async () =>
            JSON.stringify({
              accessToken: 'test-access-token',
              user: { id: '1', email: 'test@example.com' },
            }),
        } as Response);

      const token = await getAuthToken(port, 'test@example.com', 'password123');

      assert.strictEqual(token, 'test-access-token');
    });

    it('should throw error for failed authentication', async () => {
      // Mock fetch for failed authentication
      global.fetch = async () =>
        ({
          status: 401,
          text: async () => JSON.stringify({ message: 'Invalid credentials' }),
        } as Response);

      try {
        await getAuthToken(port, 'test@example.com', 'wrong-password');
        assert.fail('Should have thrown error');
      } catch (error: any) {
        assert.ok(error.message.includes('Authentication failed'));
      }
    });

    it('should throw error when no accessToken in response', async () => {
      // Mock fetch with no accessToken in data
      global.fetch = async () =>
        ({
          status: 201,
          text: async () => JSON.stringify({ user: { id: '1' } }), // Data without accessToken
        } as Response);

      try {
        await getAuthToken(port, 'test@example.com', 'password123');
        assert.fail('Should have thrown error');
      } catch (error: any) {
        assert.ok(error.message.includes('No access token in authentication response'));
      }
    });

    it('should include captcha in request', async () => {
      let capturedBody: any;
      global.fetch = async (url: any, options: any) => {
        capturedBody = JSON.parse(options.body);
        return {
          status: 201,
          text: async () => JSON.stringify({ accessToken: 'token' }),
        } as Response;
      };

      await getAuthToken(port, 'test@example.com', 'password123');

      assert.strictEqual(capturedBody.captcha, 'pixie');
      assert.strictEqual(capturedBody.strategy, 'local');
    });
  });

  // handleResponse is a private function, so we test it indirectly through makeApiRequest
});
