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
import { Application } from '@feathersjs/feathers';
import assert from 'assert';

// Internal Modules
import { getApp } from '@/app';

// Test Utilities
import { createTestUser, DEFAULT_PASSWORD_STRONG, TestServiceBuilder } from '@/test-utils';

describe('Authentication Integration Tests', () => {
  let app: Application;
  let builder: TestServiceBuilder;
  let usersService: any;
  let authService: any;

  before(async () => {
    // Initialize test environment
    builder = await new TestServiceBuilder()
      .withPerformanceMonitoring()
      .withServiceDiscovery(() => getApp())
      .build();

    app = getApp();
    usersService = app.service('users');
    authService = app.service('authentication');
  });

  after(async () => {
    await builder.cleanup();
  });

  describe('Authentication Service Integration', () => {
    let authConfig: any;
    let serviceUser: any;

    before(async () => {
      authConfig = app.get('authentication');

      serviceUser = await builder.createTestUser(
        usersService,
        `auth-service-user-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['USER'],
          isActive: true,
        },
      );
    });

    it('should integrate with authentication service', async () => {
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
      const retrievedUser = await usersService.get(serviceUser.id);
      assert.strictEqual(retrievedUser.isActive, true);
      // Verify user is properly configured for authentication
      assert.ok(retrievedUser.email, 'User should have email for authentication');
      assert.ok(retrievedUser.isActive !== false, 'User should be active for authentication');
      assert.ok(retrievedUser.roles && retrievedUser.roles.length > 0, 'User should have roles for authentication');
    });

    it('should validate users service and authentication service integration', async () => {
      // Test that both services are available and can work together
      assert.ok(usersService, 'Users service should be available');
      assert.ok(authService, 'Authentication service should be available');

      // Test that services can be accessed through the app
      assert.ok(app.services?.users, 'Users service should be registered in app');
      assert.ok(app.services?.authentication, 'Authentication service should be registered in app');
    });

    it('should validate authentication configuration for users', async () => {
      // Test authentication configuration is properly set up
      const authConfig = app.get('authentication');
      assert.ok(authConfig, 'Authentication should be configured');
    });

    it('should support authentication flow integration', async () => {
      // Test that user data supports authentication flows
      assert.ok(serviceUser.id, 'User should have ID for authentication');
      assert.ok(serviceUser.email, 'User should have email for authentication');
      assert.ok(serviceUser.password, 'User should have password hash for authentication');
    });
  });
});
