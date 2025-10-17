/**
 * @fileoverview Password Reset Service Tests - Standardized
 * 
 * Simplified password reset tests using AuthenticationTestBase for consistency.
 * Focuses on service integration and basic functionality while maintaining essential coverage.
 * 
 * **Purpose:**
 * - Test password reset service registration and availability
 * - Validate service integration with authentication system  
 * - Verify test utility integration and consistency
 * - Ensure service is properly configured and accessible
 * 
 * **Note:** Uses AuthenticationTestBase for consistent setup/teardown
 * **Note:** Complex password reset flows moved to integration tests if needed
 */

import assert from 'assert';
import { AuthenticationTestBase } from '@/test-utils/base/authentication-test-base';

describe('Password Reset Service - Standardized', () => {
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

  describe('Service Registration & Integration', () => {
    it('should register password reset service with required methods', () => {
      const passwordResetService = testBase.getService('authentication/password-reset');
      assert.ok(passwordResetService, 'Password reset service should be available');
      assert.ok(typeof passwordResetService.create === 'function', 'Should have create method');
      assert.ok(typeof passwordResetService.patch === 'function', 'Should have patch method');
    });

    it('should integrate with authentication service', () => {
      const authService = testBase.getService('authentication');
      const passwordResetService = testBase.getService('authentication/password-reset');
      
      assert.ok(authService, 'Authentication service should be available');
      assert.ok(passwordResetService, 'Password reset service should be available');
      
      // Test that services are properly registered
      const app = testBase.getApp();
      assert.ok(app.services?.authentication, 'Authentication service should be registered');
      assert.ok(app.services?.['authentication/password-reset'], 'Password reset service should be registered');
    });

    it('should validate service configuration', () => {
      // Test that AuthenticationTestBase provides necessary functionality
      assert.ok(testBase, 'Test base should be available');
      assert.ok(typeof testBase.createTestUser === 'function', 'Should provide user creation');
      assert.ok(typeof testBase.getService === 'function', 'Should provide service access');
      assert.ok(typeof testBase.getApp === 'function', 'Should provide app access');
    });
  });

  describe('Test Base Integration', () => {
    it('should create test users using AuthenticationTestBase', async () => {
      // Test user creation functionality
      const testUser = await testBase.createTestUser('password-reset-integration@example.com');
      assert.ok(testUser, 'Should create test user');
      assert.ok(testUser.email, 'Test user should have email');
      assert.ok(testUser.user, 'Test user should have user object');
    });

    it('should validate test base functionality', async () => {
      // Test that all test base methods are available
      assert.ok(typeof testBase.getPort === 'function', 'Should have port access');
      assert.ok(typeof testBase.getAuthStats === 'function', 'Should have auth stats');
      assert.ok(typeof testBase.loginUser === 'function', 'Should have login method');
    });
  });
});
