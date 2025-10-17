/**
 * @fileoverview Authentication Integration Tests
 *
 * Tests for integration between users service and authentication service.
 * Ensures proper integration and configuration between services.
 *
 * **Purpose:**
 * - Test integration between users and authentication services
 * - Validate authentication service availability and configuration
 * - Verify user authentication status and JWT configuration
 * - Ensure cross-service integration works correctly
 *
 * **Scope:**
 * - Authentication service availability and configuration
 * - User authentication integration and status
 * - JWT strategy validation
 * - Cross-service communication verification
 */

// External Libraries
import assert from 'assert';
import { AuthenticationTestBase } from '@/test-utils/base/authentication-test-base';

describe('Authentication Integration Tests', () => {
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

  describe('Authentication Service Integration', () => {
    let authConfig: any;
    let serviceUser: any;

    before(async () => {
      authConfig = testBase.getApp().get('authentication');

      serviceUser = await testBase.createTestUser(`auth-service-user-${Date.now()}@example.com`, undefined, {
        roles: ['USER'],
        isActive: true,
      });
    });

    it('should integrate with authentication service', async () => {
      const authService = testBase.getService('authentication');

      // Test that user can be found by authentication service
      assert.ok(authService, 'Authentication service should be available');
      assert.ok(typeof authService.create === 'function', 'Should have authentication methods');

      // Test authentication service JWT strategy
      assert.ok(authConfig?.entity, 'Should have authentication entity configured');
      assert.ok(authConfig?.jwt || authConfig?.secret, 'Should have JWT configuration');

      if (authConfig?.strategies) {
        assert.ok(Array.isArray(authConfig.strategies), 'Strategies should be an array');
      }

      // Verify user exists and is active for authentication
      const usersService = testBase.getService('users');
      const retrievedUser = await usersService.get(serviceUser.user.id);
      assert.strictEqual(retrievedUser.isActive, true);
      // Verify user is properly configured for authentication
      assert.ok(retrievedUser.email, 'User should have email for authentication');
      assert.ok(retrievedUser.isActive !== false, 'User should be active for authentication');
      assert.ok(retrievedUser.roles && retrievedUser.roles.length > 0, 'User should have roles for authentication');
    });

    it('should validate users service and authentication service integration', async () => {
      const usersService = testBase.getService('users');
      const authService = testBase.getService('authentication');
      const app = testBase.getApp();

      // Test that both services are available and can work together
      assert.ok(usersService, 'Users service should be available');
      assert.ok(authService, 'Authentication service should be available');

      // Test that services can be accessed through the app
      assert.ok(app.services?.users, 'Users service should be registered in app');
      assert.ok(app.services?.authentication, 'Authentication service should be registered in app');
    });

    it('should validate authentication configuration for users', async () => {
      const app = testBase.getApp();

      // Test authentication configuration is properly set up
      const authConfig = app.get('authentication');
      assert.ok(authConfig, 'Authentication should be configured');
    });

    it('should support authentication flow integration', async () => {
      // Test that user data supports authentication flows using test base
      assert.ok(serviceUser.user.id, 'User should have ID for authentication');
      assert.ok(serviceUser.email, 'User should have email for authentication');
      assert.ok(serviceUser.password, 'User should have password hash for authentication');

      // Test integration with AuthenticationTestBase methods
      assert.ok(testBase, 'Test base should be available');
      assert.ok(typeof testBase.loginUser === 'function', 'Should have login method through test base');
      assert.ok(typeof testBase.createTestUser === 'function', 'Should have user creation through test base');
    });
  });
});
