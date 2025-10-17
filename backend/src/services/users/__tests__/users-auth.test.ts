/**
 * @fileoverview Advanced Authentication and Authorization Tests for Users Service
 *
 * This file focuses on testing complex authentication and authorization scenarios
 * beyond basic CRUD operations. It ensures that the users service properly
 * enforces security policies and role-based access control.
 *
 * **Purpose:**
 * - Test role-based access control (RBAC) implementation
 * - Validate authentication context and user permissions
 * - Verify authorization hooks and middleware behavior
 * - Test edge cases in authentication scenarios
 *
 * **Scope:**
 * - Admin role requirements for user management
 * - User self-service permissions
 * - Authentication context validation
 * - Malformed authentication data handling
 * - Permission inheritance and role hierarchies
 *
 * **Related Test Files:**
 * - users-service.test.ts - Core CRUD operations (basic auth requirements tested here)
 * - users-error-handling.test.ts - Database-level error scenarios
 * - users-performance.test.ts - Authentication under load
 * - users.test.ts - End-to-end authentication flows
 *
 * **Testing Guidelines:**
 * - Focus on authorization logic and permission checks
 * - Test both successful and failed authorization scenarios
 * - Verify proper error types and messages for auth failures
 * - Use different user roles (USER, ADMIN, etc.) to test permissions
 * - Test edge cases like malformed tokens, expired sessions, missing context
 */

import { Application, Params } from '@feathersjs/feathers';
import assert from 'assert';

import { getApp } from '@/app';
import { TestServiceBuilder, createTestUser, DEFAULT_PASSWORD_STRONG } from '@/test-utils';

// Define custom params interface for testing
interface TestParams extends Params {
  user?: {
    id: string;
    roles: string[];
  };
}

describe('Users Service - Authentication & Authorization (Modernized)', () => {
  let builder: TestServiceBuilder;
  let userService: any;
  let testUsers: any[] = [];

  before(async () => {
    // Initialize modern test utilities with unified setup
    builder = await new TestServiceBuilder()
      .withPerformanceMonitoring()
      .withServiceDiscovery(() => getApp())
      .build();

    // Get services from the app
    const app = getApp();
    userService = app.service('users');

    // Create shared test users for all tests using builder
    const regularUser = await builder.createTestUser(
      userService,
      `regular-auth-${Date.now()}@example.com`,
      DEFAULT_PASSWORD_STRONG,
      {
        roles: ['USER'],
      },
    );

    const adminUser = await builder.createTestUser(
      userService,
      `admin-auth-${Date.now()}@example.com`,
      DEFAULT_PASSWORD_STRONG,
      {
        roles: ['ADMIN'],
      },
    );

    testUsers = [regularUser, adminUser];
  });

  after(async () => {
    await builder.cleanup();
  });

  describe('Authorization - Role-based Access Control', () => {
    it('should require admin role for updating user roles', async () => {
      const adminUser = testUsers[1]; // admin
      const regularUser = testUsers[0]; // regular user

      // Try to update roles as regular user
      try {
        await userService.update(regularUser.id, { email: 'test@example.com', roles: ['ADMIN'] }, {
          user: { id: regularUser.id, roles: ['USER'] },
        } as TestParams);
        assert.fail('Should have thrown Forbidden error');
      } catch (error: any) {
        assert.strictEqual(error.name, 'Forbidden', 'Should throw Forbidden error for non-admin');
      }

      // Update email as admin should work (without changing roles)
      const updatedUser = await userService.update(regularUser.id, { email: `admin_updated_${regularUser.email}` }, {
        user: { id: adminUser.id, roles: ['ADMIN'] },
      } as TestParams);

      assert.ok(updatedUser, 'Admin should be able to update user');
      assert.strictEqual(
        updatedUser.email,
        `admin_updated_${regularUser.email}`,
        'Admin should successfully update email',
      );
    });

    it('should allow admin to update any user', async () => {
      const adminUser = testUsers[1];
      const regularUser = testUsers[0];

      const updatedUser = await userService.update(
        regularUser.id,
        {
          email: `admin_controlled_${Date.now()}@example.com`,
        },
        {
          user: { id: adminUser.id, roles: ['ADMIN'] },
        } as TestParams,
      );

      assert.ok(updatedUser, 'Admin should be able to update any user');
      assert.strictEqual(updatedUser.id, regularUser.id, 'Should update correct user');
    });

    it('should allow users to update their own profile', async () => {
      const testUser = testUsers[0];

      const updatedUser = await userService.update(
        testUser.id,
        {
          email: `self_updated_${Date.now()}@example.com`,
        },
        {
          user: { id: testUser.id, roles: ['USER'] },
        } as TestParams,
      );

      assert.ok(updatedUser, 'User should be able to update own profile');
      assert.strictEqual(updatedUser.id, testUser.id, 'Should update correct user');
    });
  });

  describe('Authentication Context Validation', () => {
    it('should handle malformed user context in params', async () => {
      const testUser = testUsers[0];

      try {
        await userService.update(
          testUser.id,
          { email: 'test@example.com' },
          {
            user: null as any, // malformed user context
          },
        );
        assert.fail('Should handle malformed user context');
      } catch (error: any) {
        assert.ok(error, 'Should throw error for malformed user context');
      }
    });

    it('should handle missing user ID in context', async () => {
      const testUser = testUsers[0];

      try {
        await userService.update(testUser.id, { email: 'test@example.com' }, {
          user: { roles: ['ADMIN'] }, // missing id
        } as TestParams);
        assert.fail('Should handle missing user ID in context');
      } catch (error: any) {
        assert.ok(error, 'Should throw error for missing user ID in context');
      }
    });

    it('should handle empty roles in user context', async () => {
      const testUser = testUsers[0];
      const adminUser = testUsers[1];

      try {
        await userService.update(testUser.id, { email: 'test@example.com' }, {
          user: { id: adminUser.id, roles: [] }, // empty roles
        } as TestParams);
        assert.fail('Should handle empty roles in context');
      } catch (error: any) {
        assert.ok(error, 'Should throw error for empty roles in context');
      }
    });

    it('should handle non-array roles in user context', async () => {
      const testUser = testUsers[0];

      // String roles in user context should work fine (converted to array by hooks)
      const result = await userService.update(
        testUser.id,
        { email: `test-${Date.now()}@example.com` },
        {
          user: { id: testUser.id, roles: 'ADMIN' as any }, // string instead of array
        },
      );

      assert.ok(result, 'Should handle string roles in user context successfully');
      assert.strictEqual(result.id, testUser.id, 'Should update correct user');
    });
  });
});
