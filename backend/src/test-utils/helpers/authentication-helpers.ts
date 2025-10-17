/**
 * Authentication Helpers - Simplified JWT testing flows and automatic token management
 *
 * Provides utilities for:
 * - Simplified JWT testing flows with automatic token management
 * - Authentication state tracking across test scenarios
 * - Token refresh and validation helpers
 * - Login/logout flow automation
 */

import { TestContext } from '../core/context';
import { CacheManager } from '../memoization/cache-manager';
import { TestServiceBuilder } from '../builders/test-service-builder';
import { DEFAULT_PASSWORD_STRONG } from '../api/auth-client';

/**
 * Authentication state for a user
 */
export interface AuthenticationState {
  user: any;
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    tokenType?: string;
  };
  isAuthenticated: boolean;
  lastLogin?: Date;
  loginAttempts: number;
  metadata?: Record<string, any>;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password?: string;
  strategy?: string;
  metadata?: Record<string, any>;
}

/**
 * Authentication flow configuration
 */
export interface AuthenticationFlowConfig {
  userService?: any;
  authService?: any;
  apiClient?: any;
  port?: number;
  defaultPassword?: string;
  tokenCacheEnabled?: boolean;
  autoRefresh?: boolean;
  refreshThreshold?: number; // minutes before expiry to refresh
}

/**
 * JWT token information
 */
export interface JwtTokenInfo {
  token: string;
  payload: any;
  header: any;
  signature: string;
  expiresAt?: Date;
  issuedAt?: Date;
  issuer?: string;
  subject?: string;
  audience?: string[];
}

/**
 * Authentication helper class for managing auth state and flows
 */
export class AuthenticationHelper {
  private authStates = new Map<string, AuthenticationState>();
  private tokenCache = new Map<string, JwtTokenInfo>();
  private config: Required<AuthenticationFlowConfig>;
  private builder?: TestServiceBuilder;

  constructor(config: AuthenticationFlowConfig = {}) {
    this.config = {
      userService: config.userService,
      authService: config.authService,
      apiClient: config.apiClient,
      port: config.port || 3030,
      defaultPassword: DEFAULT_PASSWORD_STRONG,
      tokenCacheEnabled: true,
      autoRefresh: true,
      refreshThreshold: 5, // 5 minutes
      ...config,
    };
  }

  /**
   * Set TestServiceBuilder instance
   */
  withBuilder(builder: TestServiceBuilder): this {
    this.builder = builder;
    return this;
  }

  /**
   * Register a user for authentication tracking
   */
  registerUser(user: any, initialTokens?: AuthenticationState['tokens']): AuthenticationState {
    const userKey = this.getUserKey(user);

    const authState: AuthenticationState = {
      user,
      tokens: initialTokens || {
        accessToken: '',
        refreshToken: '',
        tokenType: 'Bearer',
      },
      isAuthenticated: false,
      loginAttempts: 0,
      metadata: {},
    };

    this.authStates.set(userKey, authState);
    return authState;
  }

  /**
   * Login user with credentials
   */
  async login(credentials: LoginCredentials): Promise<AuthenticationState> {
    const { email, password, strategy = 'local', metadata } = credentials;

    if (!this.config.authService) {
      throw new Error('Authentication service not configured');
    }

    const passwordToUse = password || this.config.defaultPassword;

    try {
      // Attempt login
      const loginResult = await this.config.authService.create({
        email,
        password: passwordToUse,
        strategy,
      });

      if (!loginResult.user || !loginResult.accessToken) {
        throw new Error('Login failed: No user or access token returned');
      }

      // Extract tokens
      const tokens = {
        accessToken: loginResult.accessToken,
        refreshToken: loginResult.refreshToken,
        expiresAt: this.parseTokenExpiry(loginResult.accessToken),
        tokenType: 'Bearer',
      };

      // Update authentication state
      const userKey = this.getUserKey(loginResult.user);
      let authState = this.authStates.get(userKey);

      if (!authState) {
        authState = this.registerUser(loginResult.user, tokens);
      } else {
        authState.tokens = tokens;
        authState.lastLogin = new Date();
      }

      authState.isAuthenticated = true;
      authState.loginAttempts += 1;

      if (metadata) {
        authState.metadata = { ...authState.metadata, ...metadata };
      }

      // Cache token info if enabled
      if (this.config.tokenCacheEnabled) {
        this.cacheTokenInfo(loginResult.accessToken, tokens.expiresAt);
      }

      return authState;
    } catch (error) {
      // Update failed login attempt
      const userKey = email;
      let authState = this.authStates.get(userKey);

      if (authState) {
        authState.loginAttempts += 1;
        authState.isAuthenticated = false;
      }

      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(userOrEmail: any | string): Promise<void> {
    const userKey = typeof userOrEmail === 'string' ? userOrEmail : this.getUserKey(userOrEmail);
    const authState = this.authStates.get(userKey);

    if (authState && this.config.authService) {
      try {
        await this.config.authService.remove(authState.tokens.accessToken);
      } catch (error) {
        console.warn('Logout request failed:', error);
      }

      authState.isAuthenticated = false;
      authState.tokens = {
        accessToken: '',
        refreshToken: '',
        tokenType: 'Bearer',
      };

      // Clear cached token
      if (this.config.tokenCacheEnabled) {
        this.tokenCache.delete(authState.tokens.accessToken);
      }
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(userOrEmail: any | string): Promise<AuthenticationState> {
    const userKey = typeof userOrEmail === 'string' ? userOrEmail : this.getUserKey(userOrEmail);
    const authState = this.authStates.get(userKey);

    if (!authState || !authState.tokens.refreshToken) {
      throw new Error('No refresh token available');
    }

    if (!this.config.authService) {
      throw new Error('Authentication service not configured');
    }

    try {
      const refreshResult = await this.config.authService.create({
        refreshToken: authState.tokens.refreshToken,
        strategy: 'jwt',
      });

      if (!refreshResult.accessToken) {
        throw new Error('Token refresh failed: No access token returned');
      }

      // Update tokens
      authState.tokens = {
        accessToken: refreshResult.accessToken,
        refreshToken: refreshResult.refreshToken || authState.tokens.refreshToken,
        expiresAt: this.parseTokenExpiry(refreshResult.accessToken),
        tokenType: 'Bearer',
      };

      // Cache new token info
      if (this.config.tokenCacheEnabled) {
        this.cacheTokenInfo(refreshResult.accessToken, authState.tokens.expiresAt);
      }

      return authState;
    } catch (error) {
      // Refresh failed - mark as unauthenticated
      authState.isAuthenticated = false;
      throw error;
    }
  }

  /**
   * Validate if token is still valid
   */
  isTokenValid(userOrEmail: any | string): boolean {
    const userKey = typeof userOrEmail === 'string' ? userOrEmail : this.getUserKey(userOrEmail);
    const authState = this.authStates.get(userKey);

    if (!authState || !authState.tokens.expiresAt) {
      return false;
    }

    const now = new Date();
    const expiresAt = new Date(authState.tokens.expiresAt);

    return expiresAt > now;
  }

  /**
   * Check if token needs refresh
   */
  shouldRefreshToken(userOrEmail: any | string): boolean {
    const userKey = typeof userOrEmail === 'string' ? userOrEmail : this.getUserKey(userOrEmail);
    const authState = this.authStates.get(userKey);

    if (!authState || !authState.tokens.expiresAt) {
      return false;
    }

    const now = new Date();
    const expiresAt = new Date(authState.tokens.expiresAt);
    const threshold = this.config.refreshThreshold * 60 * 1000; // Convert to milliseconds

    return expiresAt.getTime() - now.getTime() < threshold;
  }

  /**
   * Get authentication state for user
   */
  getAuthState(userOrEmail: any | string): AuthenticationState | undefined {
    const userKey = typeof userOrEmail === 'string' ? userOrEmail : this.getUserKey(userOrEmail);
    return this.authStates.get(userKey);
  }

  /**
   * Get all authenticated users
   */
  getAuthenticatedUsers(): AuthenticationState[] {
    return Array.from(this.authStates.values()).filter((state) => state.isAuthenticated);
  }

  /**
   * Make authenticated API request
   */
  async makeAuthenticatedRequest(
    userOrEmail: any | string,
    endpoint: string,
    options: {
      method?: string;
      data?: any;
      headers?: Record<string, string>;
    } = {},
  ): Promise<any> {
    const userKey = typeof userOrEmail === 'string' ? userOrEmail : this.getUserKey(userOrEmail);
    const authState = this.authStates.get(userKey);

    if (!authState || !authState.isAuthenticated || !authState.tokens.accessToken) {
      throw new Error(`User ${userKey} is not authenticated`);
    }

    // Auto-refresh token if needed
    if (this.config.autoRefresh && this.shouldRefreshToken(userOrEmail)) {
      await this.refreshToken(userOrEmail);
      // Get updated auth state after refresh
      const updatedAuthState = this.authStates.get(userKey);
      if (updatedAuthState) {
        authState.tokens = updatedAuthState.tokens;
      }
    }

    // Use builder's API client if available, otherwise fallback to direct API call
    if (this.builder) {
      return this.builder.makeAuthenticatedRequest(
        this.config.port,
        endpoint,
        authState.tokens.accessToken,
        options.data,
        {
          method: options.method,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${authState.tokens.accessToken}`,
          },
        },
      );
    } else if (this.config.apiClient) {
      // Use provided API client
      const response = await this.config.apiClient.makeAuthenticatedReliableRequest(
        this.config.port,
        endpoint,
        authState.tokens.accessToken,
        options.data,
        {
          method: options.method,
          headers: options.headers,
        },
      );
      return response.data || response;
    } else {
      throw new Error('No API client available for authenticated requests');
    }
  }

  /**
   * Parse JWT token to extract expiration date
   */
  private parseTokenExpiry(token: string): Date | undefined {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return undefined;
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      if (payload.exp) {
        return new Date(payload.exp * 1000); // Convert from seconds to milliseconds
      }

      return undefined;
    } catch (error) {
      console.warn('Failed to parse token expiry:', error);
      return undefined;
    }
  }

  /**
   * Cache token information
   */
  private cacheTokenInfo(token: string, expiresAt?: Date): void {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return;
      }

      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

      const tokenInfo: JwtTokenInfo = {
        token,
        payload,
        header,
        signature: parts[2],
        expiresAt,
        issuedAt: payload.iat ? new Date(payload.iat * 1000) : undefined,
        issuer: payload.iss,
        subject: payload.sub,
        audience: payload.aud,
      };

      this.tokenCache.set(token, tokenInfo);
    } catch (error) {
      console.warn('Failed to cache token info:', error);
    }
  }

  /**
   * Get cached token information
   */
  getTokenInfo(token: string): JwtTokenInfo | undefined {
    return this.tokenCache.get(token);
  }

  /**
   * Generate user key for tracking
   */
  private getUserKey(user: any): string {
    return user.email || user.id || JSON.stringify(user);
  }

  /**
   * Clear all authentication states
   */
  clearAllAuthStates(): void {
    this.authStates.clear();
    this.tokenCache.clear();
  }

  /**
   * Get authentication statistics
   */
  getAuthStats(): {
    totalUsers: number;
    authenticatedUsers: number;
    failedLogins: number;
    successfulLogins: number;
  } {
    const states = Array.from(this.authStates.values());
    const authenticatedUsers = states.filter((state) => state.isAuthenticated).length;
    const totalLoginAttempts = states.reduce((sum, state) => sum + state.loginAttempts, 0);

    return {
      totalUsers: states.length,
      authenticatedUsers,
      failedLogins: totalLoginAttempts - authenticatedUsers,
      successfulLogins: authenticatedUsers,
    };
  }
}

/**
 * Global authentication helper instance
 */
export const authenticationHelper = new AuthenticationHelper();

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Login user with default settings
 */
export async function loginUser(
  email: string,
  password?: string,
  config?: Partial<AuthenticationFlowConfig>,
): Promise<AuthenticationState> {
  const helper = config ? new AuthenticationHelper(config) : authenticationHelper;
  return helper.login({ email, password });
}

/**
 * Logout user with default settings
 */
export async function logoutUser(userOrEmail: any | string, config?: Partial<AuthenticationFlowConfig>): Promise<void> {
  const helper = config ? new AuthenticationHelper(config) : authenticationHelper;
  return helper.logout(userOrEmail);
}

/**
 * Make authenticated API request with default settings
 */
export async function makeAuthRequest(
  userOrEmail: any | string,
  endpoint: string,
  options: {
    method?: string;
    data?: any;
    headers?: Record<string, string>;
  } = {},
  config?: Partial<AuthenticationFlowConfig>,
): Promise<any> {
  const helper = config ? new AuthenticationHelper(config) : authenticationHelper;
  return helper.makeAuthenticatedRequest(userOrEmail, endpoint, options);
}

/**
 * Create authentication helper with custom configuration
 */
export function createAuthenticationHelper(config?: AuthenticationFlowConfig): AuthenticationHelper {
  return new AuthenticationHelper(config);
}

/**
 * Validate JWT token format and expiration
 */
export function validateToken(token: string): { valid: boolean; expired?: boolean; error?: string } {
  try {
    const helper = authenticationHelper;
    const tokenInfo = helper.getTokenInfo(token);

    if (!tokenInfo) {
      return { valid: false, error: 'Token not cached or invalid' };
    }

    if (tokenInfo.expiresAt && tokenInfo.expiresAt <= new Date()) {
      return { valid: false, expired: true, error: 'Token has expired' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Extract token information without validation
 */
export function parseTokenInfo(token: string): JwtTokenInfo | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

    return {
      token,
      payload,
      header,
      signature: parts[2],
      expiresAt: payload.exp ? new Date(payload.exp * 1000) : undefined,
      issuedAt: payload.iat ? new Date(payload.iat * 1000) : undefined,
      issuer: payload.iss,
      subject: payload.sub,
      audience: payload.aud,
    };
  } catch (error) {
    return null;
  }
}
