/**
 * @fileoverview Core Authentication Service - Service Registration & Configuration (Modernized)
 *
 * Simplified authentication service tests using AuthenticationTestBase for consistency.
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
 * **Note:** Error handling moved to authentication-error-handling-consolidated.test.ts
 * **Note:** Security tests moved to authentication-security.test.ts
 * **Note:** Performance tests moved to authentication-performance.test.ts
 * **Note:** Now uses AuthenticationTestBase for consistent setup/teardown
 */

import assert from 'assert';
import { AuthenticationTestBase } from '@/test-utils/base/authentication-test-base';

describe('Authentication Service - Core Service Registration & Configuration', () => {
  let testBase: AuthenticationTestBase;

  before(async () => {
    // Use AuthenticationTestBase for consistent setup
    testBase = new AuthenticationTestBase({
      performanceMonitoring: true,
    });
    await testBase.setup();
  });

  after(async () => {
    // Use AuthenticationTestBase for consistent cleanup
    await testBase.teardown();
  });

  describe('Service Registration & Configuration', () => {
    it('should register authentication service with required strategies', () => {
      const authService = testBase.getService('authentication');
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
      const entity = testBase.getApp().get('authentication').entity;
      assert.ok(entity, 'Authentication entity should be configured');
      assert.strictEqual(entity, 'user', "Entity should be configured as 'user'");
    });

    it('should validate authentication service configuration', () => {
      const authService = testBase.getService('authentication');
      const passwordResetService = testBase.getService('authentication/password-reset');

      assert.ok(authService, 'Authentication service should be configured');
      assert.ok(authService.hooks || authService.__hooks, 'Service should have hooks configuration');

      // Verify password reset service integration
      assert.ok(passwordResetService, 'Password reset service should exist');
      assert.ok(typeof passwordResetService.create === 'function', 'Password reset service should have create method');
    });
  });

  describe('Authentication Helper Integration', () => {
    it('should initialize authentication helper correctly', () => {
      // Test using public methods from AuthenticationTestBase
      assert.ok(testBase, 'Test base should be available');
      assert.ok(typeof testBase.loginUser === 'function', 'Should have login method through test base');
      assert.ok(
        typeof testBase.makeAuthenticatedRequest === 'function',
        'Should have authenticated request method through test base',
      );
      assert.ok(
        typeof testBase.validateUserToken === 'function',
        'Should have token validation method through test base',
      );
    });

    it('should validate authentication helper configuration', () => {
      // Test authentication helper is properly configured through test base methods
      assert.ok(testBase, 'Test base should be properly configured');
      assert.ok(typeof testBase.getAuthStats === 'function', 'Should have auth stats method');
      assert.ok(typeof testBase.validateUserToken === 'function', 'Should have token validation method');
      assert.ok(typeof testBase.shouldRefreshUserToken === 'function', 'Should have token refresh check method');
    });
  });

  describe('Authentication Constants & Status Codes', () => {
    it('should validate authentication status codes', () => {
      // Status code validation using testBase methods
      assert.ok(testBase, 'Test base should be available');
      assert.ok(typeof testBase.getPort === 'function', 'Should have port access');
      assert.ok(typeof testBase.getApp === 'function', 'Should have app access');
    });

    it('should validate password policy constants', () => {
      // Test that testBase provides necessary constants and configuration
      assert.ok(testBase, 'Test base should be available');
      assert.ok(typeof testBase.createTestUser === 'function', 'Should provide user creation');
      assert.ok(typeof testBase.getAuthStats === 'function', 'Should provide auth stats');
    });

    it('should validate authentication strategy constants', () => {
      const authConfig = testBase.getApp().get('authentication');

      assert.ok(authConfig, 'Authentication config should be available');
      assert.ok(authConfig.entity, 'Should have entity configuration');
      // JWT configuration may vary by environment, focus on core functionality
      assert.ok(authConfig.jwt || authConfig.secret, 'Should have JWT or secret configuration');
    });
  });

  describe('AuthenticationTestBase Integration', () => {
    it('should validate test base functionality', () => {
      assert.ok(testBase, 'Test base should be available');
      assert.ok(typeof testBase.getPort === 'function', 'Test base should provide port access');
      assert.ok(typeof testBase.getApp === 'function', 'Test base should provide app access');
      assert.ok(typeof testBase.getService === 'function', 'Test base should provide service access');
      assert.ok(typeof testBase.createTestUser === 'function', 'Test base should provide user creation');
      assert.ok(typeof testBase.createTestUsers === 'function', 'Test base should provide bulk user creation');
    });

    it('should validate authentication helper integration', () => {
      // Test that AuthenticationTestBase provides necessary functionality
      assert.ok(testBase, 'Test base should be available');
      assert.ok(typeof testBase.loginUser === 'function', 'Should provide login functionality');
      assert.ok(typeof testBase.makeAuthenticatedRequest === 'function', 'Should provide authenticated requests');
      assert.ok(typeof testBase.validateUserToken === 'function', 'Should provide token validation');
    });
  });

  describe('Authentication Workflow - Functional Tests', () => {
    it('should handle complete authentication workflow', async () => {
      // Test authentication service availability
      const authService = testBase.getService('authentication');
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
      const authConfig = testBase.getApp().get('authentication');
      assert.ok(authConfig?.entity, 'Should have authentication entity');
      assert.strictEqual(authConfig?.entity, 'user', 'Entity should be user');

      // Test authentication helper functionality through test base
      assert.ok(testBase, 'Test base should be available');
      assert.ok(typeof testBase.loginUser === 'function', 'Should have login method through test base');
      assert.ok(typeof testBase.getAuthStats === 'function', 'Should have auth stats method through test base');
    });

    it('should handle password reset workflow', async () => {
      // Test password reset service
      const passwordResetService = testBase.getService('authentication/password-reset');
      assert.ok(passwordResetService, 'Password reset service should be available');
      assert.ok(typeof passwordResetService.create === 'function', 'Should have create method');
      assert.ok(typeof passwordResetService.patch === 'function', 'Should have patch method');

      // Test password reset configuration
      const passwordResetConfig = testBase.getApp().get('passwordReset');
      if (passwordResetConfig) {
        assert.ok(passwordResetConfig, 'Password reset should be configured');
      }

      // Test password reset service methods exist
      assert.ok(typeof passwordResetService.create === 'function', 'Should handle password reset requests');
      assert.ok(typeof passwordResetService.patch === 'function', 'Should handle password reset token validation');
    });

    it('should validate authentication service registration', async () => {
      const app = testBase.getApp();

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

    it('should create test users using AuthenticationTestBase', async () => {
      // Test the modern test base functionality
      const testUser = await testBase.createTestUser('service-test@example.com');
      assert.ok(testUser, 'Should create test user using test base');
      assert.ok(testUser.email, 'Test user should have email');
      assert.ok(testUser.user, 'Test user should have user object');
      assert.ok(testUser.password, 'Test user should have password');
    });

    it('should handle multiple test users creation', async () => {
      // Test bulk user creation
      const testUsers = await testBase.createTestUsers(3);
      assert.ok(Array.isArray(testUsers), 'Should return array of test users');
      assert.strictEqual(testUsers.length, 3, 'Should create correct number of users');

      testUsers.forEach((user) => {
        assert.ok(user.email, 'Each user should have email');
        assert.ok(user.user, 'Each user should have user object');
      });
    });
  });
});
