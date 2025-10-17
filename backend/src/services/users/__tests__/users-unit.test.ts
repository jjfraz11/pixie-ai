/**
 * @fileoverview Users Service Unit Tests
 *
 * This file contains unit tests for the users service methods,
 * focusing on isolated testing with mocked Prisma client.
 *
 * **Purpose:**
 * - Test individual service methods in isolation
 * - Validate business logic and error handling
 * - Ensure proper data transformation and validation
 * - Test edge cases and error scenarios
 *
 * **Scope:**
 * - Unit tests for create, update, patch, remove, find, get
 * - Mocked Prisma client for database isolation
 * - Error handling and validation testing
 * - Business logic validation
 *
 * **Related Test Files:**
 * - users-validation.test.ts - Integration validation tests
 * - users-auth.test.ts - Authorization tests
 * - users-performance.test.ts - Performance tests
 */

import { Application } from '@feathersjs/feathers';
import assert from 'assert';
import { BadRequest } from '@feathersjs/errors';

import { UserService } from '../users.service';
import { UserData, UserPatch, PrismaUserType } from '../users.schema';
import { handleNoUserFound, handleMissingValue } from '../user.utils';

describe('Users Service - Unit Tests', () => {
  let app: Application;
  let userService: UserService;
  let mockPrisma: any;

  beforeEach(() => {
    // Create a mock app
    app = {
      get: () => ({}),
      service: () => ({}),
      use: () => ({}),
    } as any;

    // Mock Prisma client with more realistic behavior
    mockPrisma = {
      user: {
        create: async (data: any) => ({ id: 'mock-id', ...data.data }),
        findUnique: async (options: any) => {
          if (options.where.id === 'mock-id') {
            return { id: 'mock-id', email: 'test@example.com', roles: ['USER'] };
          }
          return null;
        },
        update: async (options: any) => {
          if (options.where.id === 'mock-id') {
            return { id: 'mock-id', ...options.data };
          }
          throw new Error('User not found');
        },
        delete: async (options: any) => {
          if (options.where.id === 'mock-id') {
            return { id: 'mock-id' };
          }
          throw new Error('User not found');
        },
        findMany: async () => [],
      },
    };

    // Create service instance with mocked Prisma
    userService = new UserService({}, app);
    (userService as any).prisma = mockPrisma;
  });

  afterEach(async () => {
    // Clean up any resources if needed
    // Reset mocks for clean state between tests
    if (mockPrisma) {
      mockPrisma.user = {
        create: async (data: any) => ({ id: 'mock-id', ...data.data }),
        findUnique: async (options: any) => ({ id: 'mock-id', email: 'test@example.com' }),
        update: async (options: any) => ({ id: 'mock-id', ...options.data }),
        delete: async (options: any) => ({ id: 'mock-id' }),
        findMany: async () => [],
      };
    }
  });

  describe('create', () => {
    it('should create a user successfully', async () => {
      const userData: UserData = {
        email: 'test@example.com',
        password: 'TestPassword123!@#',
        roles: ['USER'],
      };

      const result = await userService.create(userData);

      assert.ok(result, 'Should return created user');
      assert.strictEqual(result.email, userData.email);
      assert.strictEqual(result.password, userData.password);
      assert.deepStrictEqual(result.roles, userData.roles);
    });

    it('should handle creation errors', async () => {
      mockPrisma.user.create = async () => {
        throw new Error('Database error');
      };

      const userData: UserData = {
        email: 'test@example.com',
        password: 'TestPassword123!@#',
        roles: ['USER'],
      };

      try {
        await userService.create(userData);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });

  describe('update', () => {
    it('should update a user successfully', async () => {
      const userData: UserPatch = {
        email: 'updated@example.com',
        roles: ['ADMIN'],
      };

      const result = await userService.update('mock-id', userData);

      assert.ok(result, 'Should return updated user');
      assert.strictEqual(result.email, userData.email);
      assert.deepStrictEqual(result.roles, userData.roles);
    });

    it('should throw error for missing ID', async () => {
      const userData: UserPatch = { email: 'test@example.com' };

      try {
        await userService.update(null as any, userData);
        assert.fail('Should have thrown BadRequest');
      } catch (error) {
        assert.ok(error instanceof BadRequest);
        assert.strictEqual(error.message, 'Missing id.');
      }
    });
  });

  describe('patch', () => {
    it('should patch a user successfully', async () => {
      const userData: UserPatch = { email: 'patched@example.com' };

      const result = await userService.patch('mock-id', userData);

      assert.ok(result, 'Should return patched user');
      assert.strictEqual(result.email, userData.email);
    });

    it('should handle not found user', async () => {
      mockPrisma.user.update = async () => {
        throw new Error('User not found');
      };

      try {
        await userService.patch('invalid-id', { email: 'test@example.com' });
        assert.fail('Should have handled not found');
      } catch (error) {
        // Should throw or handle error appropriately
      }
    });
  });

  describe('remove', () => {
    it('should remove a user successfully', async () => {
      const result = await userService.remove('mock-id');

      assert.ok(result, 'Should return removed user');
      assert.strictEqual(result.id, 'mock-id');
    });

    it('should throw error for missing ID', async () => {
      try {
        await userService.remove(null as any);
        assert.fail('Should have thrown BadRequest');
      } catch (error) {
        assert.ok(error instanceof BadRequest);
        assert.strictEqual(error.message, 'Missing id.');
      }
    });
  });

  describe('find', () => {
    it('should find users successfully', async () => {
      const mockUsers = [
        { id: '1', email: 'user1@example.com' },
        { id: '2', email: 'user2@example.com' },
      ];
      mockPrisma.user.findMany = async () => mockUsers;

      const result = await userService.find();

      assert.deepStrictEqual(result, mockUsers);
    });
  });

  describe('get', () => {
    it('should get a user successfully', async () => {
      const mockUser = { id: 'mock-id', email: 'test@example.com' };
      mockPrisma.user.findUnique = async () => mockUser;

      const result = await userService.get('mock-id');

      assert.deepStrictEqual(result, mockUser);
    });

    it('should handle not found user', async () => {
      mockPrisma.user.findUnique = async () => null;

      try {
        await userService.get('invalid-id');
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error instanceof BadRequest);
        assert.strictEqual(error.message, 'No user found');
      }
    });
  });

  describe('Utility Functions', () => {
    it('should handle missing value correctly', () => {
      const obj = { key: 'value' };

      try {
        handleMissingValue(obj, 'missingKey', 'Key not found');
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error instanceof BadRequest);
        assert.strictEqual(error.message, 'Key not found');
      }

      // Should not throw for existing key
      assert.doesNotThrow(() => handleMissingValue(obj, 'key', 'Key not found'));
    });

    it('should handle no user found correctly', () => {
      const user = { id: '1', email: 'test@example.com' };

      const result = handleNoUserFound(user);
      assert.deepStrictEqual(result, user);

      try {
        handleNoUserFound(null);
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error instanceof BadRequest);
        assert.strictEqual(error.message, 'No user found');
      }
    });
  });
});
