/**
 * @fileoverview Authentication Test Base Class
 *
 * Shared authentication test base class that provides consistent setup/teardown patterns,
 * reusable test data creation methods, and common authentication scenarios for all
 * authentication test files. Designed to eliminate repetitive setup code and provide
 * a foundation for consolidating the massive error handling file.
 *
 * **Features:**
 * - Consistent setup/teardown patterns using TestServiceBuilder
 * - AuthenticationHelper initialization with proper configuration
 * - Reusable test data creation methods (users, sessions, participants)
 * - Common authentication scenarios (login, logout, token validation)
 * - Support for both successful and error case testing patterns
 * - Built-in performance monitoring and caching
 * - Comprehensive cleanup and resource management
 */

import { Application } from '@feathersjs/feathers';
import { SessionType } from '@prisma/client';

import { getApp } from '@/app';
import {
  TestServiceBuilder,
  AuthenticationHelper,
  UserFactory,
  SessionFactory,
  ParticipantFactory,
  createAuthScenario,
  createUsers,
  STATUS_CODE_CREATED,
  STATUS_CODE_UNAUTHORIZED,
  STATUS_CODE_BAD_REQUEST,
  STATUS_CODE_SUCCESS,
  DEFAULT_PASSWORD_STRONG,
  DEFAULT_PASSWORD_WEAK,
  DEFAULT_CAPTCHA,
} from '@/test-utils';

/**
 * Configuration options for AuthenticationTestBase
 */
export interface AuthenticationTestBaseConfig {
  /** Enable performance monitoring */
  performanceMonitoring?: boolean;
  /** Enable test isolation */
  isolation?: boolean;
  /** Custom isolation key */
  isolationKey?: string;
  /** Auto-refresh tokens during tests */
  autoRefresh?: boolean;
  /** Token cache enabled */
  tokenCacheEnabled?: boolean;
  /** Custom port for testing */
  port?: number;
  /** Default password for test users */
  defaultPassword?: string;
  /** Number of default test users to create */
  defaultUserCount?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom app factory function */
  appFactory?: () => Application;
}

/**
 * Test user data structure
 */
export interface TestUserData {
  user: any;
  email: string;
  password: string;
  roles?: string[];
  accessToken?: string;
  refreshToken?: string;
  isAuthenticated?: boolean;
}

/**
 * Authentication scenario data
 */
export interface AuthenticationScenarioData {
  users: TestUserData[];
  adminUser?: TestUserData;
  regularUser?: TestUserData;
  broadcasterUser?: TestUserData;
  multiRoleUser?: TestUserData;
}

/**
 * Error scenario configuration
 */
export interface ErrorScenarioConfig {
  /** Type of error to test */
  errorType: 'validation' | 'authentication' | 'authorization' | 'security' | 'system';
  /** Expected status code */
  expectedStatus?: number;
  /** Expected error message patterns */
  expectedErrors?: string[];
  /** Whether to expect specific error structure */
  expectErrorStructure?: boolean;
  /** Custom error data for testing */
  errorData?: any;
}

/**
 * Shared authentication test base class that eliminates repetitive setup code
 * and provides consistent patterns across all authentication test files.
 */
export class AuthenticationTestBase {
  protected builder!: TestServiceBuilder;
  protected authHelper!: AuthenticationHelper;
  protected userService!: any;
  protected authService!: any;
  protected sessionService!: any;
  protected participantService!: any;
  protected passwordResetService!: any;
  protected app!: Application;
  protected port!: number;
  protected config: Required<AuthenticationTestBaseConfig>;

  // Test data
  protected testUsers: TestUserData[] = [];
  protected authScenario?: AuthenticationScenarioData;

  // Factories
  protected userFactory!: UserFactory;
  protected sessionFactory!: SessionFactory;
  protected participantFactory!: ParticipantFactory;

  constructor(config: AuthenticationTestBaseConfig = {}) {
    this.config = {
      performanceMonitoring: true,
      isolation: true,
      isolationKey: `auth-test-${Date.now()}`,
      autoRefresh: false,
      tokenCacheEnabled: true,
      port: 3030,
      defaultPassword: DEFAULT_PASSWORD_STRONG,
      defaultUserCount: 3,
      debug: false,
      appFactory: () => getApp(),
      ...config,
    };
  }

  /**
   * Setup method to be called in before() hooks
   * Provides consistent initialization across all authentication tests
   */
  async setup(): Promise<void> {
    // Initialize TestServiceBuilder with consistent configuration
    this.builder = new TestServiceBuilder({
      performance: {
        enabled: this.config.performanceMonitoring,
      },
      isolation: {
        enabled: this.config.isolation,
        key: this.config.isolationKey,
      },
    });

    // Configure builder with standard options
    if (this.config.performanceMonitoring) {
      this.builder.withPerformanceMonitoring();
    }

    if (this.config.isolation) {
      this.builder.withIsolation(this.config.isolationKey);
    }

    // Build and start server
    await this.builder.build();
    this.port = await this.builder.startServer(this.config.appFactory);

    // Get application and services
    this.app = this.config.appFactory();
    this.userService = this.app.service('users');
    this.authService = this.app.service('authentication');
    this.sessionService = this.app.service('sessions');
    this.participantService = this.app.service('participants');
    this.passwordResetService = this.app.service('authentication/password-reset');

    // Initialize AuthenticationHelper with consistent configuration
    this.authHelper = new AuthenticationHelper({
      userService: this.userService,
      authService: this.authService,
      port: this.port,
      defaultPassword: this.config.defaultPassword,
      autoRefresh: this.config.autoRefresh,
      tokenCacheEnabled: this.config.tokenCacheEnabled,
    }).withBuilder(this.builder);

    // Initialize factories
    const context = this.builder.getContext();
    if (!context) {
      throw new Error('TestServiceBuilder context not initialized');
    }

    this.userFactory = new UserFactory(context, this.builder['cacheManager']);
    this.sessionFactory = new SessionFactory(context, this.builder['cacheManager']);
    this.participantFactory = new ParticipantFactory(context, this.builder['cacheManager']);

    // Log setup completion if debug enabled
    if (this.config.debug) {
      console.log(`AuthenticationTestBase setup completed on port ${this.port}`);
    }
  }

  /**
   * Teardown method to be called in after() hooks
   * Provides consistent cleanup across all authentication tests
   */
  async teardown(): Promise<void> {
    try {
      // Clear authentication states
      this.authHelper.clearAllAuthStates();

      // Cleanup all test data
      await this.cleanupTestUsers();

      // Cleanup builder resources
      if (this.builder) {
        await this.builder.cleanup();
      }

      if (this.config.debug) {
        console.log('AuthenticationTestBase teardown completed');
      }
    } catch (error) {
      console.warn('Error during AuthenticationTestBase teardown:', error);
    }
  }

  /**
   * Cleanup test users created during testing
   */
  private async cleanupTestUsers(): Promise<void> {
    for (const testUser of this.testUsers) {
      try {
        if (testUser.user?.id) {
          await this.userService.remove(testUser.user.id);
        }
      } catch (error) {
        if (this.config.debug) {
          console.warn(`Failed to cleanup test user ${testUser.email}:`, error);
        }
      }
    }
    this.testUsers = [];
  }

  /**
   * Create test users with consistent patterns
   */
  async createTestUsers(count: number = this.config.defaultUserCount): Promise<TestUserData[]> {
    const users: TestUserData[] = [];

    for (let i = 0; i < count; i++) {
      const email = `test-user-${Date.now()}-${i}@example.com`;
      const user = await this.createTestUser(email, this.config.defaultPassword, {
        roles: i === 0 ? ['ADMIN'] : ['USER'],
      });

      users.push(user);
    }

    this.testUsers = users;
    return users;
  }

  /**
   * Create a single test user with authentication state
   */
  async createTestUser(
    email: string,
    password: string = this.config.defaultPassword,
    additionalData: any = {},
  ): Promise<TestUserData> {
    // Use factory to create user
    const user = await this.userFactory.createTestUser(
      this.userService,
      email,
      password,
      { roles: ['USER'], ...additionalData },
      true,
    );

    const testUserData: TestUserData = {
      user,
      email,
      password,
      roles: user.roles || ['USER'],
      isAuthenticated: false,
    };

    this.testUsers.push(testUserData);
    return testUserData;
  }

  /**
   * Create authentication scenario with multiple user roles
   */
  async createAuthenticationScenario(userCount: number = 4): Promise<AuthenticationScenarioData> {
    const scenario = await createAuthScenario(this.userService, {
      userCount,
      userRoles: ['USER', 'ADMIN', 'BROADCASTER', 'USER'],
      additionalUserData: { roles: ['USER', 'BROADCASTER'] },
      makeUnique: true,
    });

    // Convert scenario users to TestUserData format
    const testUsers: TestUserData[] = scenario.users.map((user: any) => ({
      user,
      email: user.email,
      password: user.password || this.config.defaultPassword,
      roles: user.roles,
      isAuthenticated: false,
    }));

    // Identify users by roles
    const adminUser = testUsers.find((u) => u.roles?.includes('ADMIN'));
    const regularUser = testUsers.find(
      (u) => u.roles?.includes('USER') && !u.roles?.includes('ADMIN') && !u.roles?.includes('BROADCASTER'),
    );
    const broadcasterUser = testUsers.find((u) => u.roles?.includes('BROADCASTER') && !u.roles?.includes('USER'));
    const multiRoleUser = testUsers.find((u) => u.roles?.includes('USER') && u.roles?.includes('BROADCASTER'));

    this.authScenario = {
      users: testUsers,
      adminUser,
      regularUser,
      broadcasterUser,
      multiRoleUser,
    };

    return this.authScenario;
  }

  /**
   * Login user and update authentication state
   */
  async loginUser(userOrEmail: TestUserData | string, password?: string): Promise<TestUserData> {
    const email = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail.email;
    const userPassword = password || this.config.defaultPassword;

    const authState = await this.authHelper.login({
      email,
      password: userPassword,
    });

    // Update test user data with authentication info
    const testUser = typeof userOrEmail === 'string' ? this.testUsers.find((u) => u.email === email) : userOrEmail;

    if (testUser) {
      testUser.accessToken = authState.tokens.accessToken;
      testUser.refreshToken = authState.tokens.refreshToken;
      testUser.isAuthenticated = true;
    }

    if (!testUser) {
      throw new Error(`Test user not found for email: ${email}`);
    }

    return testUser;
  }

  /**
   * Logout user and clear authentication state
   */
  async logoutUser(userOrEmail: TestUserData | string): Promise<void> {
    await this.authHelper.logout(userOrEmail);

    // Update test user data
    const email = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail.email;
    const testUser = this.testUsers.find((u) => u.email === email);

    if (testUser) {
      testUser.accessToken = undefined;
      testUser.refreshToken = undefined;
      testUser.isAuthenticated = false;
    }
  }

  /**
   * Make authenticated API request using test user
   */
  async makeAuthenticatedRequest(
    userOrEmail: TestUserData | string,
    endpoint: string,
    options: {
      method?: string;
      data?: any;
      headers?: Record<string, string>;
    } = {},
  ): Promise<any> {
    return this.authHelper.makeAuthenticatedRequest(userOrEmail, endpoint, options);
  }

  /**
   * Validate JWT token for user
   */
  validateUserToken(userOrEmail: TestUserData | string): boolean {
    return this.authHelper.isTokenValid(userOrEmail);
  }

  /**
   * Check if user token needs refresh
   */
  shouldRefreshUserToken(userOrEmail: TestUserData | string): boolean {
    return this.authHelper.shouldRefreshToken(userOrEmail);
  }

  /**
   * Get authentication statistics
   */
  getAuthStats() {
    return this.authHelper.getAuthStats();
  }

  /**
   * Create test session
   */
  async createTestSession(type: SessionType, hostUser: TestUserData, additionalData: any = {}) {
    return this.sessionFactory.createTestSession(this.sessionService, type, hostUser.user, additionalData);
  }

  /**
   * Create test participant
   */
  async createTestParticipant(sessionId: string, userId: string, additionalData: any = {}) {
    return this.participantFactory.createTestParticipant(this.participantService, sessionId, userId, additionalData);
  }

  /**
   * Test successful authentication scenario
   */
  async testSuccessfulAuthentication(testUser?: TestUserData): Promise<void> {
    const user = testUser || this.testUsers[0];
    if (!user) {
      throw new Error('No test user available for authentication test');
    }

    // Login user
    await this.loginUser(user);

    // Verify authentication state
    if (!user.isAuthenticated || !user.accessToken) {
      throw new Error('User authentication failed');
    }

    // Validate token
    if (!this.validateUserToken(user)) {
      throw new Error('Token validation failed');
    }

    // Make authenticated request
    const response = await this.makeAuthenticatedRequest(user, '/users', {
      method: 'GET',
    });

    if (response.status !== STATUS_CODE_SUCCESS) {
      throw new Error(`Authenticated request failed with status ${response.status}`);
    }
  }

  /**
   * Test authentication error scenario
   */
  async testAuthenticationError(config: ErrorScenarioConfig): Promise<void> {
    const { errorType, expectedStatus, expectedErrors, errorData } = config;

    let response: any;

    switch (errorType) {
      case 'authentication':
        response = await this.authHelper.login({
          email: 'nonexistent@example.com',
          password: 'wrongpassword',
        });
        break;

      case 'validation':
        response = await fetch(`http://localhost:${this.port}/authentication`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategy: 'local',
            email: 'invalid-email',
            password: 'weak',
            captcha: DEFAULT_CAPTCHA,
            ...errorData,
          }),
        }).then((res) => res.json());
        break;

      case 'authorization':
        // Create user and login first
        const testUser = await this.createTestUser(`authz-test-${Date.now()}@example.com`);
        await this.loginUser(testUser);

        // Try to access admin endpoint as regular user
        response = await this.makeAuthenticatedRequest(testUser, '/admin/users', {
          method: 'GET',
        });
        break;

      case 'security':
        response = await fetch(`http://localhost:${this.port}/authentication`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategy: 'local',
            email: '<script>alert("xss")</script>@example.com',
            password: DEFAULT_PASSWORD_STRONG,
            captcha: DEFAULT_CAPTCHA,
            ...errorData,
          }),
        }).then((res) => res.json());
        break;

      default:
        throw new Error(`Unsupported error type: ${errorType}`);
    }

    // Validate response
    if (expectedStatus && response.status !== expectedStatus) {
      throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
    }

    if (expectedErrors && expectedErrors.length > 0) {
      const responseErrors = response.errors || [];
      const hasExpectedError = expectedErrors.some((expectedError) =>
        responseErrors.some((responseError: string) => responseError.includes(expectedError)),
      );

      if (!hasExpectedError) {
        throw new Error(
          `Expected errors not found. Expected: ${expectedErrors.join(', ')}, Got: ${responseErrors.join(', ')}`,
        );
      }
    }
  }

  /**
   * Test token refresh scenario
   */
  async testTokenRefresh(testUser?: TestUserData): Promise<void> {
    const user = testUser || this.testUsers[0];
    if (!user) {
      throw new Error('No test user available for token refresh test');
    }

    // Login user first
    await this.loginUser(user);

    if (!user.isAuthenticated || !user.accessToken) {
      throw new Error('User login failed for token refresh test');
    }

    const oldToken = user.accessToken;

    // Refresh token
    await this.authHelper.refreshToken(user);

    // Verify token changed
    if (user.accessToken === oldToken) {
      throw new Error('Token was not refreshed');
    }

    // Verify new token is valid
    if (!this.validateUserToken(user)) {
      throw new Error('Refreshed token is invalid');
    }
  }

  /**
   * Test concurrent authentication scenarios
   */
  async testConcurrentAuthentication(userCount: number = 3): Promise<void> {
    const users = await this.createTestUsers(userCount);

    // Login all users concurrently
    const loginPromises = users.map((user) => this.loginUser(user));
    const authStates = await Promise.all(loginPromises);

    // Verify all users are authenticated
    for (const authState of authStates) {
      if (!authState.isAuthenticated || !authState.accessToken) {
        throw new Error(`Concurrent authentication failed for user ${authState.email}`);
      }
    }

    // Make concurrent authenticated requests
    const requestPromises = authStates.map((authState) =>
      this.makeAuthenticatedRequest(authState, '/users', { method: 'GET' }),
    );

    const responses = await Promise.all(requestPromises);

    // Verify all requests succeeded
    for (const response of responses) {
      if (response.status !== STATUS_CODE_SUCCESS) {
        throw new Error(`Concurrent authenticated request failed with status ${response.status}`);
      }
    }
  }

  /**
   * Test password reset flow
   */
  async testPasswordResetFlow(testUser?: TestUserData): Promise<void> {
    const user = testUser || this.testUsers[0];
    if (!user) {
      throw new Error('No test user available for password reset test');
    }

    // Request password reset
    const resetRequestResponse = await fetch(`http://localhost:${this.port}/authentication/password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'request',
        email: user.email,
      }),
    }).then((res) => res.json());

    if (resetRequestResponse.status !== STATUS_CODE_CREATED) {
      throw new Error('Password reset request failed');
    }

    // Note: In a real implementation, you would extract the reset token from email
    // For testing purposes, we'll assume the token is available or use a mock
    const resetToken = 'mock-reset-token'; // In real tests, this would come from email

    // Change password with reset token
    const newPassword = 'NewPassword123!';
    const changeResponse = await fetch(`http://localhost:${this.port}/authentication/password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'change',
        token: resetToken,
        newPassword,
      }),
    }).then((res) => res.json());

    if (changeResponse.status !== STATUS_CODE_CREATED) {
      throw new Error('Password reset change failed');
    }

    // Verify password was changed by attempting login with new password
    await this.loginUser(user.email, newPassword);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return this.builder.getPerformanceMetrics();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.builder.getCacheStats();
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.builder.clearCaches();
  }

  /**
   * Get current port
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Get application instance
   */
  getApp(): Application {
    return this.app;
  }

  /**
   * Get service by name
   */
  getService(serviceName: string): any {
    return this.app.service(serviceName);
  }

  /**
   * Wait for specified milliseconds (useful for testing timing)
   */
  async wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
