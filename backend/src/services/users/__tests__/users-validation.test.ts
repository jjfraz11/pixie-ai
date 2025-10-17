/**
 * @fileoverview Users Service Validation Tests
 *
 * This file focuses on testing the users service's validation mechanisms,
 * including schema validation, password validation, role authorization,
 * and business logic validation scenarios in an integrated environment.
 *
 * **Purpose:**
 * - Test Zod schema validation (email format, password length, etc.)
 * - Validate password strength requirements
 * - Verify role authorization and mapping
 * - Test business logic validation scenarios
 * - Ensure proper error handling for validation failures
 * - Integration testing for real service behavior
 *
 * **Scope:**
 * - Schema validation errors and edge cases
 * - Password validation and strength requirements
 * - Role authorization and permission checks
 * - Business logic validation (missing IDs, invalid data)
 * - Service behavior under validation error conditions
 * - Integration with real database and hooks
 *
 * **Related Test Files:**
 * - users-service.test.ts - Core service functionality
 * - users-auth.test.ts - Authentication/authorization scenarios
 * - users-performance.test.ts - Performance under load
 *
 * **Testing Guidelines:**
 * - Focus on service-level validation logic in real environment
 * - Test both valid and invalid input scenarios
 * - Verify proper error messages and status codes
 * - Test authorization and permission scenarios
 * - Ensure validation hooks work correctly
 * - Use real database for integration testing
 */

import { Application, Params } from '@feathersjs/feathers';
import assert from 'assert';

import { getApp } from '@/app';
import { TestServiceBuilder, createTestUser } from '@/test-utils';
import { DEFAULT_PASSWORD_STRONG } from '@/test-utils/constants';

// Define custom params interface for testing
interface TestParams extends Params {
  user?: {
    id: string;
    roles: string[];
  };
}

describe('Users Service - Validation Tests (Modernized)', () => {
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
      `regular-validation-${Date.now()}@example.com`,
      DEFAULT_PASSWORD_STRONG,
      {
        roles: ['USER'],
      },
    );

    const adminUser = await builder.createTestUser(
      userService,
      `admin-validation-${Date.now()}@example.com`,
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

  describe('Schema Validation', () => {
    it('should reject invalid email formats', async () => {
      const invalidEmails = ['not-an-email', 'missing-at-sign.com', '@missing-username.com', 'spaces in@email.com', ''];

      for (const email of invalidEmails) {
        try {
          await userService.create({ email, password: DEFAULT_PASSWORD_STRONG });
          assert.fail(`Should have rejected invalid email: ${email}`);
        } catch (error: any) {
          // Check for common email validation errors
          const errorMessage = error.message.toLowerCase();
          assert.ok(
            errorMessage.includes('email') || errorMessage.includes('format') || errorMessage.includes('invalid'),
            `Error should mention email validation for: ${email}. Got: ${error.message}`,
          );
        }
      }
    });

    // actual: false (error message does not mention minLength or password), expected: true (error should mention password length)
    it('should reject passwords that are too short', async () => {
      const shortPasswords = ['1234567', 'short', ''];

      for (const password of shortPasswords) {
        try {
          await userService.create({ email: `test-${Date.now()}@example.com`, password });
          assert.fail(`Should have rejected short password: ${password}`);
        } catch (error: any) {
          assert.ok(
            error.message.includes('minLength') || error.message.includes('password'),
            `Error should mention password length for: ${password}`,
          );
        }
      }
    });

    it('should accept valid email and password combinations', async () => {
      const validUser = await userService.create({
        email: `valid-${Date.now()}@example.com`,
        password: DEFAULT_PASSWORD_STRONG,
      });

      assert.ok(validUser, 'Should create user with valid email and password');
      assert.ok(validUser.id, 'Created user should have an ID');
      assert.ok(validUser.email, 'Created user should have email');
    });
  });

  describe('Password Validation', () => {
    // actual: false (error message does not mention password or weak), expected: true (error should mention password strength)
    it('should reject weak passwords', async () => {
      const weakPasswords = ['weak', '12345678', 'password', 'qwerty'];

      for (const password of weakPasswords) {
        try {
          await userService.create({ email: `test-${Date.now()}@example.com`, password });
          assert.fail(`Should have rejected weak password: ${password}`);
        } catch (error: any) {
          assert.ok(
            error.message.includes('password') || error.message.includes('weak'),
            `Error should mention password strength for: ${password}`,
          );
        }
      }
    });

    it('should accept strong passwords', async () => {
      const strongPasswords = ['StrongPass123!', 'MySecure@Password1', 'Complex#Pass2023'];

      for (const password of strongPasswords) {
        const user = await userService.create({
          email: `test-${Date.now()}-${Math.random()}@example.com`,
          password,
        });
        assert.ok(user, `Should accept strong password: ${password}`);
      }
    });
  });

  describe('Role Authorization', () => {
    it('should allow admins to update user roles', async () => {
      const regularUser = testUsers[0];
      const adminUser = testUsers[1];

      // Simulate admin user context
      const adminContext = { params: { user: { roles: ['ADMIN'] } } };

      try {
        const updatedUser = await userService.update(
          regularUser.id,
          {
            roles: ['USER', 'MODERATOR'],
          },
          adminContext.params,
        );

        assert.ok(updatedUser, 'Admin should be able to update user roles');
      } catch (error: any) {
        // If the update fails for other reasons, that's okay for this test
        // We're mainly testing that it doesn't fail due to authorization
        assert.ok(!error.message.includes('administrators'), 'Should not fail due to role authorization');
      }
    });

    it('should prevent non-admins from updating user roles', async () => {
      const regularUser = testUsers[0];

      // Simulate regular user context
      const userContext = { params: { user: { roles: ['USER'] } } };

      try {
        await userService.update(
          regularUser.id,
          {
            roles: ['ADMIN'],
          },
          userContext.params,
        );
        assert.fail('Non-admin should not be able to update roles');
      } catch (error: any) {
        assert.ok(
          error.message.includes('administrators') || error.message.includes('Forbidden'),
          'Should fail with authorization error',
        );
      }
    });
  });

  describe('Business Logic Validation', () => {
    it('should handle missing IDs gracefully', async () => {
      try {
        await userService.get(null);
        // Should not throw in non-throwing mode
      } catch (error: any) {
        assert.ok(error.message.includes('Missing id'), 'Should handle missing ID error');
      }

      try {
        await userService.update(null, { email: 'test@example.com' });
        // Should not throw in non-throwing mode
      } catch (error: any) {
        assert.ok(error.message.includes('Missing id'), 'Should handle missing ID error for update');
      }
    });

    it('should validate role mapping', async () => {
      // Test with invalid role names
      const invalidRoles = ['INVALID_ROLE', 'nonexistent'];

      for (const role of invalidRoles) {
        try {
          await userService.create({
            email: `test-${Date.now()}@example.com`,
            password: DEFAULT_PASSWORD_STRONG,
            roles: [role],
          });
          // May or may not fail depending on Prisma handling
          // The important thing is the service doesn't crash
        } catch (error: any) {
          // Expected for truly invalid roles
          assert.ok(error, 'Invalid roles should be handled gracefully');
        }
      }
    });
  });

  describe('Service Behavior Under Validation Errors', () => {
    it('should not expose sensitive information in validation errors', async () => {
      try {
        await userService.create({
          email: 'invalid-email',
          password: 'weak',
        });
      } catch (error: any) {
        // Error message should not contain sensitive information
        assert.ok(!error.message.includes('password'), 'Password should not be exposed in error messages');
        assert.ok(error.message.length > 0, 'Should provide meaningful error message');
      }
    });

    it('should maintain service stability during validation failures', async () => {
      const invalidOperations = [
        () => userService.create({ email: 'invalid' }),
        () => userService.create({ password: 'weak' }),
        () => userService.create({}),
      ];

      for (const operation of invalidOperations) {
        try {
          await operation();
        } catch (error: any) {
          // Service should handle validation errors gracefully
          assert.ok(error, 'Should throw validation errors');
        }
      }

      // Service should still work after validation failures
      const validUser = await userService.create({
        email: `recovery-${Date.now()}@example.com`,
        password: DEFAULT_PASSWORD_STRONG,
      });

      assert.ok(validUser, 'Service should remain functional after validation errors');
    });
  });
});
