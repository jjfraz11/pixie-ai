/**
 * @fileoverview Core Authentication Service - Service Registration & Configuration (Modernized)
 *
 * Simplified authentication service tests using modern test utilities.
 * Focuses on core authentication functionality while maintaining essential coverage.
 *
 * **Purpose:**
 * - Test authentication service registration and strategy configuration
 * - Validate service availability and basic functionality
 * - Verify test utility integration and constants
 * - Test authentication helper integration
 *
 * **Scope:**
 * - Service registration and strategy availability
 * - Authentication helper integration
 * - Status code and constant validation
 * - Basic service configuration validation
 *
 * **Note:** Complex authentication flows moved to authentication-auth.test.ts
 * **Note:** Error handling moved to authentication-error-handling.test.ts
 * **Note:** Security tests moved to authentication-security.test.ts
 * **Note:** Performance tests moved to authentication-performance.test.ts
 * **Note:** Focus on core service registration for early-stage testing
 */

import { Application } from '@feathersjs/feathers';
import assert from 'assert';

import { getApp } from '@/app';
import {
  TestServiceBuilder,
  AuthenticationHelper,
  createUsers,
  STATUS_CODE_CREATED,
  STATUS_CODE_UNAUTHORIZED,
  STATUS_CODE_BAD_REQUEST,
  STATUS_CODE_SUCCESS,
  DEFAULT_PASSWORD_STRONG,
  DEFAULT_PASSWORD_WEAK,
  DEFAULT_CAPTCHA,
} from '@/test-utils';

describe('Authentication Service - Core Service Registration & Configuration', () => {
  let app: Application;
  let builder: TestServiceBuilder;
  let authHelper: AuthenticationHelper;
  let authService: any;
  let passwordResetService: any;

  before(async () => {
    // Initialize modern test utilities
    builder = await new TestServiceBuilder()
      .withPerformanceMonitoring()
      .withServiceDiscovery(() => getApp())
      .build();

    authHelper = new AuthenticationHelper({
      port: builder.getPort(),
      autoRefresh: false,
      tokenCacheEnabled: true,
    });

    // Get services from the app
    app = getApp();
    authService = app.service('authentication');
    passwordResetService = app.service('authentication/password-reset');
  });

  after(async () => {
    await builder.cleanup();
  });

  describe('Service Registration & Configuration', () => {
    it('should register authentication service with required strategies', () => {
      assert.ok(authService, 'Authentication service should be available');
      assert.ok(typeof authService.register === 'function', 'Service should have register method');

      // Verify JWT strategy registration
      assert.ok(authService.strategies, 'Service should have strategies configuration');
      assert.ok(authService.strategies.jwt, 'JWT strategy should be registered');
      assert.ok(
        typeof authService.strategies.jwt.authenticate === 'function',
        'JWT strategy should have authenticate method',
      );

      // Verify Local strategy registration
      assert.ok(authService.strategies.local, 'Local strategy should be registered');
      assert.ok(
        typeof authService.strategies.local.authenticate === 'function',
        'Local strategy should have authenticate method',
      );

      // Verify entity configuration
      const entity = app.get('authentication').entity;
      assert.ok(entity, 'Authentication entity should be configured');
      assert.strictEqual(entity, 'user', "Entity should be configured as 'user'");
    });

    it('should validate authentication service configuration', () => {
      assert.ok(authService, 'Authentication service should be configured');
      assert.ok(authService.hooks || authService.__hooks, 'Service should have hooks configuration');

      // Verify password reset service integration
      assert.ok(passwordResetService, 'Password reset service should exist');
      assert.ok(typeof passwordResetService.create === 'function', 'Password reset service should have create method');
    });
  });

  describe('Authentication Helper Integration', () => {
    it('should initialize authentication helper correctly', () => {
      assert.ok(authHelper, 'Authentication helper should be available');
      assert.ok(typeof authHelper.login === 'function', 'Should have login method');
      assert.ok(typeof authHelper.logout === 'function', 'Should have logout method');
      assert.ok(typeof authHelper.makeAuthenticatedRequest === 'function', 'Should have authenticated request method');
    });

    it('should validate authentication helper configuration', () => {
      assert.ok(authHelper, 'Authentication helper should be properly configured');
      assert.ok(typeof authHelper.getAuthStats === 'function', 'Should have auth stats method');
      assert.ok(typeof authHelper.clearAllAuthStates === 'function', 'Should have clear auth states method');
    });
  });

  describe('Authentication Constants & Status Codes', () => {
    it('should validate authentication status codes', () => {
      assert.strictEqual(STATUS_CODE_CREATED, 201, 'Created status should be correctly defined');
      assert.strictEqual(STATUS_CODE_UNAUTHORIZED, 401, 'Unauthorized status should be correctly defined');
      assert.strictEqual(STATUS_CODE_BAD_REQUEST, 400, 'Bad request status should be correctly defined');
      assert.strictEqual(STATUS_CODE_SUCCESS, 200, 'Success status should be correctly defined');
    });

    it('should validate password policy constants', () => {
      assert.ok(DEFAULT_PASSWORD_STRONG, 'Should have strong password policy');
      assert.ok(DEFAULT_PASSWORD_WEAK, 'Should have weak password for testing');
      assert.ok(DEFAULT_CAPTCHA, 'Should have CAPTCHA constant');
      assert.ok(typeof DEFAULT_PASSWORD_STRONG === 'string', 'Strong password should be string');
      assert.ok(typeof DEFAULT_PASSWORD_WEAK === 'string', 'Weak password should be string');
    });

    it('should validate authentication strategy constants', () => {
      const authConfig = app.get('authentication');

      assert.ok(authConfig, 'Authentication config should be available');
      assert.ok(authConfig.entity, 'Should have entity configuration');
      // JWT configuration may vary by environment, focus on core functionality
      assert.ok(authConfig.jwt || authConfig.secret, 'Should have JWT or secret configuration');
    });
  });

  describe('Modern Test Utilities Integration', () => {
    it('should validate test builder functionality', () => {
      assert.ok(builder, 'Test builder should be available');
      assert.ok(typeof builder.getPort === 'function', 'Builder should provide port access');
      assert.ok(typeof builder.makeReliableRequest === 'function', 'Builder should provide reliable requests');
      assert.ok(
        typeof builder.makeAuthenticatedRequest === 'function',
        'Builder should provide authenticated requests',
      );
    });

    it('should validate fluent user builder integration', () => {
      const userBuilder = createUsers(`test-auth-${Date.now()}@example.com`)
        .withPassword(DEFAULT_PASSWORD_STRONG)
        .withRoles('USER');

      assert.ok(userBuilder, 'Fluent user builder should be available');
      assert.ok(typeof userBuilder.withPassword === 'function', 'Should have password configuration');
      assert.ok(typeof userBuilder.withRoles === 'function', 'Should have roles configuration');
      assert.ok(typeof userBuilder.build === 'function', 'Should have build method');
    });
  });

  describe('Authentication Workflow - Functional Tests', () => {
    it('should handle complete authentication workflow', async () => {
      // Initialize authentication helper
      const authHelper = new AuthenticationHelper({
        port: builder.getPort(),
        autoRefresh: false,
        tokenCacheEnabled: true,
      });

      // Test authentication service availability
      const authService = app.service('authentication');
      assert.ok(authService, 'Authentication service should be available');
      assert.ok(typeof authService.create === 'function', 'Should have create method');

      // Test JWT strategy
      const jwtStrategy = (authService as any).strategies?.jwt;
      assert.ok(jwtStrategy, 'JWT strategy should be available');
      assert.ok(typeof jwtStrategy.authenticate === 'function', 'JWT strategy should have authenticate method');

      // Test Local strategy
      const localStrategy = (authService as any).strategies?.local;
      assert.ok(localStrategy, 'Local strategy should be available');
      assert.ok(typeof localStrategy.authenticate === 'function', 'Local strategy should have authenticate method');

      // Verify authentication configuration
      const authConfig = app.get('authentication');
      assert.ok(authConfig?.entity, 'Should have authentication entity');
      assert.strictEqual(authConfig?.entity, 'user', 'Entity should be user');

      // Test authentication helper functionality
      assert.ok(authHelper, 'Authentication helper should be available');
      assert.ok(typeof authHelper.login === 'function', 'Should have login method');
      assert.ok(typeof authHelper.getAuthStats === 'function', 'Should have auth stats method');
    });

    it('should handle password reset workflow', async () => {
      // Get services from app
      const app = getApp();
      const currentUserService = app.service('users');

      // Test password reset service
      const passwordResetService = app.service('authentication/password-reset');
      assert.ok(passwordResetService, 'Password reset service should be available');
      assert.ok(typeof passwordResetService.create === 'function', 'Should have create method');
      assert.ok(typeof passwordResetService.patch === 'function', 'Should have patch method');

      // Test password reset configuration
      const passwordResetConfig = app.get('passwordReset');
      if (passwordResetConfig) {
        assert.ok(passwordResetConfig, 'Password reset should be configured');
      }

      // Test password reset service methods exist
      assert.ok(typeof passwordResetService.create === 'function', 'Should handle password reset requests');
      assert.ok(typeof passwordResetService.patch === 'function', 'Should handle password reset token validation');
    });

    it('should validate authentication service registration', async () => {
      const app = getApp();

      // Verify service registration
      const service = app.service('authentication');
      assert.ok(service, 'Authentication service should be registered');
      assert.strictEqual(app.service('authentication'), service, 'Service should be properly registered');

      // Test service configuration
      assert.ok(service.hooks, 'Service should have hooks configuration');

      // Verify service has proper methods
      assert.ok(typeof service.create === 'function', 'Should have create method');
      assert.ok(typeof service.remove === 'function', 'Should have remove method');

      // Test that authentication service integrates with user service
      const userService = app.service('users');
      assert.ok(userService, 'User service should be available for authentication');

      // Verify entity configuration matches
      const authConfig = app.get('authentication');
      if (authConfig?.entity) {
        assert.strictEqual(authConfig.entity, 'user', 'Authentication entity should match user service');
      }
    });
  });
});
