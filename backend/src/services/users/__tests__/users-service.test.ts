/**
 * @fileoverview Core Users Service Tests - Service Registration & Basic Functionality
 *
 * Simplified users service tests using modern test utilities.
 * Focuses on service registration and basic functionality while maintaining essential coverage.
 *
 * **Purpose:**
 * - Verify service registration and method availability
 * - Test basic service functionality and constants
 * - Validate test utility integration
 * - Ensure service is properly configured
 *
 * **Scope:**
 * - Service registration and method availability
 * - Basic service configuration validation
 * - Test utility integration verification
 * - Core service functionality validation
 *
 * **Note:** Uses modern TestServiceBuilder for unified setup/teardown
 * **Note:** Advanced CRUD tests moved to users-validation.test.ts
 * **Note:** Authentication tests moved to users-auth.test.ts
 * **Note:** Complex scenarios simplified for early-stage testing focus
 */

// External Libraries
import { Application } from '@feathersjs/feathers';
import assert from 'assert';

// Internal Modules
import { getApp } from '@/app';

// Test Utilities
import {
  TestServiceBuilder,
  createUsers,
  STATUS_CODE_CREATED,
  STATUS_CODE_UNAUTHORIZED,
  STATUS_CODE_BAD_REQUEST,
  STATUS_CODE_SUCCESS,
  DEFAULT_PASSWORD_STRONG,
  createTestUser,
} from '@/test-utils';

describe('Users Service - Core Service Registration & Configuration', () => {
  // Test setup
  let app: Application;
  let builder: TestServiceBuilder;
  let userService: any;

  before(async () => {
    // Initialize modern test utilities with unified setup
    builder = await new TestServiceBuilder()
      .withPerformanceMonitoring()
      .withServiceDiscovery(() => getApp())
      .build();

    // Get services from the app
    app = getApp();
    userService = app.service('users');
  });

  after(async () => {
    await builder.cleanup();
  });

  describe('Service Registration & Core Operations', () => {
    it('should register users service with all CRUD methods', () => {
      assert.ok(userService, 'Users service should be available');
      assert.ok(typeof userService.find === 'function', 'Users service should have find method');
      assert.ok(typeof userService.get === 'function', 'Users service should have get method');
      assert.ok(typeof userService.create === 'function', 'Users service should have create method');
      assert.ok(typeof userService.update === 'function', 'Users service should have update method');
      assert.ok(typeof userService.patch === 'function', 'Users service should have patch method');
      assert.ok(typeof userService.remove === 'function', 'Users service should have remove method');
    });

    it('should validate service configuration and hooks', () => {
      assert.ok(userService, 'Users service should be configured');
      assert.ok(userService.hooks || userService.__hooks, 'Service should have hooks configuration');
      // Note: Hook structure may vary, focus on core functionality
    });
  });

  describe('User Management - Functional Tests', () => {
    // Test variables
    let adminUser: any;
    let regularUser: any;

    before(async () => {
      adminUser = await builder.createTestUser(
        userService,
        `admin-func-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['ADMIN'],
          isActive: true,
        },
      );

      regularUser = await builder.createTestUser(
        userService,
        `user-func-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['USER'],
          isActive: true,
        },
      );
    });

    // actual: false (0 admin users found), expected: true (at least 1 admin user)
    it('should create and manage users with different roles', async () => {
      // Test user creation
      assert.ok(adminUser.id, 'Admin user should have an ID');
      assert.ok(adminUser.email.includes('admin-func'), 'Admin user should have correct email');
      assert.ok(adminUser.roles?.includes('ADMIN'), 'Admin user should have ADMIN role');

      assert.ok(regularUser.id, 'Regular user should have an ID');
      assert.ok(regularUser.email.includes('user-func'), 'Regular user should have correct email');
      assert.ok(regularUser.roles?.includes('USER'), 'Regular user should have USER role');

      // Test user updates
      const newEmail = `updated-user-${Date.now()}@example.com`;
      const updatedUser = await userService.patch(regularUser.id, {
        email: newEmail,
      });

      assert.strictEqual(updatedUser.email, newEmail);

      // Test user queries
      const foundUsers = await userService.find({ query: { roles: ['ADMIN'] } });
      assert.ok(foundUsers.total > 0, 'Should find admin users');

      // Test user retrieval
      const retrievedUser = await userService.get(regularUser.id);
      assert.strictEqual(retrievedUser.id, regularUser.id);
      assert.strictEqual(retrievedUser.email, newEmail);

      // Note: Cleanup handled by after block to maintain caching benefits
    });

    // actual: false (0 admin users found), expected: true (at least 1 admin user)
    it('should handle user queries and filtering', async () => {
      // Test finding users by role
      const adminUsers = await userService.find({ query: { roles: ['ADMIN'] } }, adminUser);
      assert.ok(adminUsers.total >= 1, 'Should find at least one admin user');

      // Test finding users by active status
      const activeUsers = await userService.find({ query: { isActive: true } }, adminUser);
      assert.ok(activeUsers.total >= 3, 'Should find active users');

      // Test finding users by email pattern
      const exampleUsers = await userService.find({
        query: {
          email: { $like: '%example.com%' },
        },
      });
      assert.ok(exampleUsers.total >= 3, 'Should find users with example.com email');

      // Test pagination
      const paginatedUsers = await userService.find({ query: {}, $limit: 2 });
      assert.ok(paginatedUsers.limit <= 2, 'Should respect limit');

      // Note: Cleanup handled by after block to maintain caching benefits
    });
  });
});
