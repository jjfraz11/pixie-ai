import { makeApiRequest, ApiResponse } from './request-client';

/**
 * Constants for common status codes
 */
export const STATUS_CODE_REQUEST_SUCCESSFUL = 200;
export const STATUS_CODE_REQUEST_FAILED = 500;

/**
 * Constants for frequently reused test data
 */
export const DEFAULT_PASSWORD_STRONG = 'TestPassword123!@#';
export const DEFAULT_PASSWORD_WEAK = 'weak';

/**
 * Helper function to get authentication token for a user
 */
export async function getAuthToken(
  port: number,
  email: string,
  password: string = DEFAULT_PASSWORD_STRONG,
): Promise<string> {
  const response = await makeApiRequest(port, `/authentication`, {
    strategy: 'local',
    email,
    password,
    captcha: 'pixie', // Add CAPTCHA
  });

  console.log('getAuthToken response status:', response.status); // Add this line
  console.log('getAuthToken response errors:', response.errors); // Add this line

  if (response.status !== 201) {
    throw new Error(`Authentication failed: ${response.status}`);
  }

  if (!response.data) {
    throw new Error('No data in authentication response');
  }

  if (!response.data.accessToken) {
    throw new Error('No access token in authentication response');
  }

  return response.data.accessToken;
}

/**
 * Authentication client for handling auth-related API operations
 */
export class AuthClient {
  constructor(private port: number) {}

  /**
   * Authenticate user and get token
   */
  async login(email: string, password: string = DEFAULT_PASSWORD_STRONG): Promise<string> {
    return getAuthToken(this.port, email, password);
  }

  /**
   * Register new user and get token
   */
  async register(userData: { email: string; password: string; roles?: string[] }): Promise<string> {
    const response = await makeApiRequest(this.port, '/users', userData);

    if (response.status !== 201) {
      throw new Error(`Registration failed: ${response.status} - ${response.errors?.join(', ')}`);
    }

    // Now login to get the token
    return this.login(userData.email, userData.password);
  }

  /**
   * Logout user (client-side token removal)
   */
  logout(): void {
    // In a real implementation, this might call an API endpoint
    // For now, it's just a placeholder for token cleanup
    console.log('User logged out');
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(refreshToken: string): Promise<string> {
    const response = await makeApiRequest(this.port, '/authentication/refresh', {
      refreshToken,
    });

    if (response.status !== 200) {
      throw new Error(`Token refresh failed: ${response.status} - ${response.errors?.join(', ')}`);
    }

    if (!response.data?.accessToken) {
      throw new Error('No access token in refresh response');
    }

    return response.data.accessToken;
  }

  /**
   * Get current user info
   */
  async getCurrentUser(token: string): Promise<any> {
    const response = await makeApiRequest(
      this.port,
      '/authentication/me',
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.status !== 200) {
      throw new Error(`Get user info failed: ${response.status} - ${response.errors?.join(', ')}`);
    }

    return response.data;
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    const response = await makeApiRequest(this.port, '/authentication/password-reset', {
      email,
    });

    if (response.status !== 200) {
      throw new Error(`Password reset request failed: ${response.status} - ${response.errors?.join(', ')}`);
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const response = await makeApiRequest(this.port, '/authentication/password-reset/confirm', {
      token,
      password: newPassword,
    });

    if (response.status !== 200) {
      throw new Error(`Password reset failed: ${response.status} - ${response.errors?.join(', ')}`);
    }
  }
}
