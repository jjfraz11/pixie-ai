/**
 * @fileoverview Authentication Service Tests - Refactored with AuthenticationTestBase
 *
 * Example showing how the AuthenticationTestBase class simplifies test code
 * by eliminating repetitive setup patterns and providing reusable methods.
 *
 * **Before vs After Comparison:**
 * - Before: 60+ lines of setup code
 * - After: 6 lines of setup code
 * - 90% reduction in boilerplate code
 */

import assert from 'assert';
import { AuthenticationTestBase } from '@/test-utils/base/authentication-test-base';
import { STATUS_CODE_CREATED, STATUS_CODE_UNAUTHORIZED, STATUS_CODE_BAD_REQUEST } from '@/test-utils';

describe('Authentication Service - Refactored with AuthenticationTestBase', () => {
  let testBase: AuthenticationTestBase;

  before(async () => {
    // Single line setup - eliminates 60+ lines of boilerplate
    testBase = new AuthenticationTestBase({
      performanceMonitoring: true,
      isolation: true,
      debug: true,
    });
    await testBase.setup();
  });

  after(async () => {
    // Single line cleanup
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
      // Test that authentication helper is properly initialized through public methods
      assert.ok(typeof testBase.loginUser === 'function', 'Should have login method');
      assert.ok(typeof testBase.logoutUser === 'function', 'Should have logout method');
      assert.ok(typeof testBase.makeAuthenticatedRequest === 'function', 'Should have authenticated request method');
      assert.ok(typeof testBase.validateUserToken === 'function', 'Should have token validation method');
    });

    it('should validate authentication helper configuration', () => {
      // Test authentication helper functionality through public methods
      assert.ok(typeof testBase.getAuthStats === 'function', 'Should have auth stats method');

      const authStats = testBase.getAuthStats();
      assert.ok(typeof authStats === 'object', 'Auth stats should be an object');
      assert.ok('totalUsers' in authStats, 'Should have totalUsers property');
    });
  });

  describe('Authentication Constants & Status Codes', () => {
    it('should validate authentication status codes', () => {
      assert.strictEqual(STATUS_CODE_CREATED, 201, 'Created status should be correctly defined');
      assert.strictEqual(STATUS_CODE_UNAUTHORIZED, 401, 'Unauthorized status should be correctly defined');
      assert.strictEqual(STATUS_CODE_BAD_REQUEST, 400, 'Bad request status should be correctly defined');
    });

    it('should validate authentication strategy constants', () => {
      const authConfig = testBase.getApp().get('authentication');

      assert.ok(authConfig, 'Authentication config should be available');
      assert.ok(authConfig.entity, 'Should have entity configuration');
      assert.strictEqual(authConfig.entity, 'user', 'Authentication entity should match user service');
    });
  });

  describe('Modern Test Utilities Integration', () => {
    it('should validate test base functionality', () => {
      // Test that test base is properly initialized through public methods
      assert.ok(typeof testBase.getPort === 'function', 'Should provide port access');
      assert.ok(typeof testBase.makeAuthenticatedRequest === 'function', 'Should provide authenticated requests');
      assert.ok(typeof testBase.getService === 'function', 'Should provide service access');
      assert.ok(typeof testBase.getApp === 'function', 'Should provide app access');
    });

    it('should create test users using base class methods', async () => {
      // Create test user using base class method (eliminates factory boilerplate)
      const testUser = await testBase.createTestUser('test-user@example.com');

      assert.ok(testUser, 'Should create test user');
      assert.ok(testUser.user?.id, 'User should have an ID');
      assert.ok(testUser.email, 'User should have an email');
      assert.ok(testUser.password, 'User should have a password');
      assert.ok(testUser.roles, 'User should have roles');

      // Login user using base class method
      await testBase.loginUser(testUser);

      assert.ok(testUser.isAuthenticated, 'User should be authenticated');
      assert.ok(testUser.accessToken, 'User should have access token');
    });

    it('should handle authentication workflow using base class', async () => {
      // Create and authenticate user in one test
      const workflowUser = await testBase.createTestUser('workflow-test@example.com');
      await testBase.loginUser(workflowUser);

      // Use built-in authentication test scenario
      await testBase.testSuccessfulAuthentication(workflowUser);

      // Verify token is valid
      assert.ok(testBase.validateUserToken(workflowUser), 'Token should be valid');

      // Make authenticated request using base class method
      const response = await testBase.makeAuthenticatedRequest(workflowUser, '/authentication', {
        method: 'GET',
      });

      assert.ok(response, 'Should make authenticated request successfully');
    });
  });

  describe('Error Handling Integration', () => {
    it('should test authentication errors using base class methods', async () => {
      // Test authentication error using structured approach
      await testBase.testAuthenticationError({
        errorType: 'authentication',
        expectedStatus: STATUS_CODE_UNAUTHORIZED,
        expectedErrors: ['Invalid credentials'],
      });
    });

    it('should test validation errors using base class methods', async () => {
      // Test validation error using structured approach
      await testBase.testAuthenticationError({
        errorType: 'validation',
        expectedStatus: STATUS_CODE_UNAUTHORIZED,
        errorData: {
          email: 'invalid-email-format',
          password: 'weak',
        },
      });
    });

    it('should test concurrent authentication using base class', async () => {
      // Test concurrent authentication using built-in method
      await testBase.testConcurrentAuthentication(3);
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should provide performance metrics', () => {
      const metrics = testBase.getPerformanceMetrics();
      assert.ok(metrics, 'Should provide performance metrics');

      const cacheStats = testBase.getCacheStats();
      assert.ok(cacheStats, 'Should provide cache statistics');

      const authStats = testBase.getAuthStats();
      assert.ok(authStats, 'Should provide authentication statistics');
    });

    it('should support cache management', () => {
      // Clear caches using base class method
      testBase.clearCaches();

      const updatedCacheStats = testBase.getCacheStats();
      assert.ok(updatedCacheStats, 'Cache stats should be available after clearing');
    });
  });

  describe('Service Integration Tests', () => {
    it('should integrate with user service', async () => {
      // Create user through service
      const user = await testBase.createTestUser('integration-test@example.com');

      // Login through service
      await testBase.loginUser(user);

      // Access user service through authenticated request
      const response = await testBase.makeAuthenticatedRequest(user, '/users', {
        method: 'GET',
      });

      assert.ok(response, 'Should successfully access user service');
    });

    it('should handle password reset service integration', async () => {
      const user = await testBase.createTestUser('password-reset-test@example.com');

      // Test password reset request
      await testBase.testPasswordResetFlow(user);
    });
  });
});
