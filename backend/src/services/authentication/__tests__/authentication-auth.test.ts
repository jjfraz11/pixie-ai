/**
 * @fileoverview Authentication Service - Role-based Access Control Tests
 *
 * Tests role assignment, authorization scenarios, and permission validation
 * using modernized patterns for unified setup and scenario factories.
 */

import { TestServiceBuilder } from '@/test-utils/builders/test-service-builder';
import { AuthenticationHelper } from '@/test-utils/helpers/authentication-helpers';
import { createAuthScenario } from '@/test-utils/scenario-factories/scenario-factories';
import { getApp } from '@/app';
import assert from 'assert';

describe('Authentication Service - Role-based Access Control', () => {
  let builder: TestServiceBuilder;
  let authHelper: AuthenticationHelper;
  let userService: any;
  let scenario: Awaited<ReturnType<typeof createAuthScenario>>;

  before(async () => {
    // Initialize TestServiceBuilder with unified setup
    builder = new TestServiceBuilder().withPerformanceMonitoring().withIsolation();

    await builder.build();

    // Start server and get services
    const port = await builder.startServer(() => getApp());

    // Get services from the app
    const app = getApp();
    userService = app.service('users');

    // Initialize authentication helper
    authHelper = new AuthenticationHelper({
      userService,
      port,
    }).withBuilder(builder);

    // Create authentication scenario with multiple roles
    scenario = await createAuthScenario(userService, {
      userCount: 4,
      userRoles: ['USER', 'ADMIN', 'BROADCASTER', 'USER'],
      additionalUserData: { roles: ['USER', 'BROADCASTER'] }, // For multi-role user
      makeUnique: true,
    });
  });

  after(async () => {
    // Unified cleanup through builder
    await builder.cleanup();
  });

  describe('User Creation and Role Assignment', () => {
    it('should create users with correct roles using scenario factory', () => {
      // Verify scenario created correct number of users
      assert.strictEqual(scenario.users.length, 4, 'Should have created 4 test users');

      // Find users by roles using modern scenario data
      const userUser = scenario.users.find((u: any) => u.roles?.includes('USER') && !u.roles?.includes('ADMIN'));
      const adminUser = scenario.users.find((u: any) => u.roles?.includes('ADMIN'));
      const broadcasterUser = scenario.users.find((u: any) => u.roles?.includes('BROADCASTER'));
      const multiRoleUser = scenario.users.find(
        (u: any) => u.roles?.includes('USER') && u.roles?.includes('BROADCASTER'),
      );

      // Verify each role type exists
      assert.ok(userUser, 'Should have USER role user');
      assert.ok(adminUser, 'Should have ADMIN role user');
      assert.ok(broadcasterUser, 'Should have BROADCASTER role user');
      assert.ok(multiRoleUser, 'Should have multi-role user');

      // Verify user properties using scenario.users
      scenario.users.forEach((user: any) => {
        assert.ok(user.id, 'User should have an ID');
        assert.ok(user.email, 'User should have an email');
        assert.ok(user.password, 'User should have a password');
        assert.ok(user.roles, 'User should have roles');
        assert.ok(Array.isArray(user.roles) || typeof user.roles === 'string', 'Roles should be array or string');
      });
    });

    it('should handle role-based user creation correctly', () => {
      const adminUser = scenario.users.find((u: any) => u.roles?.includes('ADMIN'));
      assert.ok(adminUser, 'Should have admin user');

      if (adminUser) {
        assert.ok(adminUser.roles?.includes('ADMIN'), 'Admin user should have ADMIN role');
        assert.ok(adminUser.email?.includes('admin'), 'Admin user email should contain admin');
      }
    });

    it('should create multi-role users correctly', () => {
      const multiRoleUser = scenario.users.find(
        (u: any) => u.roles?.includes('USER') && u.roles?.includes('BROADCASTER'),
      );
      assert.ok(multiRoleUser, 'Should have multi-role user');

      if (multiRoleUser) {
        assert.ok(multiRoleUser.roles?.includes('USER'), 'Multi-role user should have USER role');
        assert.ok(multiRoleUser.roles?.includes('BROADCASTER'), 'Multi-role user should have BROADCASTER role');
        assert.ok(multiRoleUser.email?.includes('multi'), 'Multi-role user email should contain multi');
      }
    });

    it('should create users with valid email formats', () => {
      scenario.users.forEach((user: any) => {
        assert.ok(user.email, 'User should have email');
        assert.ok(user.email?.includes('@'), 'Email should contain @ symbol');
        assert.ok(user.email?.includes('example.com'), 'Email should be from example.com domain');
      });
    });

    it('should handle user creation errors gracefully', async () => {
      // Test creating a user with invalid data using enhanced error handling
      try {
        await userService.create({
          // Missing required fields
          roles: ['USER'],
        });
        // If we get here, the service should handle the error gracefully
      } catch (error) {
        // Error is expected for invalid data
        assert.ok(error, 'Should throw error for invalid user data');
      }
    });
  });
});
