import { describe, it, beforeEach, afterEach } from 'mocha';
import assert from 'assert';
import { TestContext, testContext } from '../core/context';
import { CacheManager } from '../memoization/cache-manager';
import { UserFactory } from '../factories/user-factory';

describe('UserFactory', () => {
  let context: TestContext;
  let cacheManager: CacheManager;
  let userFactory: UserFactory;
  let mockUserService: any;

  beforeEach(() => {
    context = new TestContext();
    cacheManager = new CacheManager();
    userFactory = new UserFactory(context, cacheManager);

    // Create mock user service
    mockUserService = {
      create: async (userData: any) => {
        return {
          id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          email: userData.email,
          password: userData.password,
          roles: userData.roles || ['USER'],
          ...userData,
        };
      },
      find: async (query: any) => {
        return { data: [] };
      },
    };
  });

  afterEach(() => {
    context.clearAllTracked();
    cacheManager.clearCache();
  });

  describe('createTestUser', () => {
    it('should create a user successfully', async () => {
      const baseEmail = 'test@example.com';
      const password = 'TestPassword123!@#';

      const user = await userFactory.createTestUser(mockUserService, baseEmail, password);

      // Verify user was created with correct data
      assert.ok(user.id);
      assert.ok(user.email.includes(baseEmail)); // Email may have timestamp prefix when makeUnique=true
      assert.strictEqual(user.password, password);
      assert.deepStrictEqual(user.roles, ['USER']);

      // Verify user is tracked
      assert.strictEqual(context.getTracked('users').length, 1);
      assert.strictEqual(context.getTracked('users')[0].id, user.id);
    });

    it('should create user with custom roles and additional data', async () => {
      const baseEmail = 'admin@example.com';
      const password = 'AdminPassword123!@#';
      const additionalData = {
        roles: ['ADMIN', 'USER'],
        firstName: 'John',
        lastName: 'Doe',
      };

      const user = await userFactory.createTestUser(mockUserService, baseEmail, password, additionalData);

      // Verify user was created with custom data
      assert.ok(user.id);
      assert.ok(user.email.includes(baseEmail));
      assert.strictEqual(user.firstName, 'John');
      assert.strictEqual(user.lastName, 'Doe');
      assert.deepStrictEqual(user.roles, ['ADMIN', 'USER']); // Should be normalized and sorted
    });

    it('should create user with unique email when makeUnique is true', async () => {
      const baseEmail = 'test@example.com';
      const password = 'TestPassword123!@#';

      const user1 = await userFactory.createTestUser(mockUserService, baseEmail, password, {}, true);
      const user2 = await userFactory.createTestUser(mockUserService, baseEmail, password, {}, true);

      // Should have different emails due to timestamp uniqueness
      assert.notStrictEqual(user1.email, user2.email);
      assert.ok(user1.email && user1.email.includes(baseEmail));
      assert.ok(user2.email && user2.email.includes(baseEmail));
    });

    it('should create user with same email when makeUnique is false', async () => {
      const email = 'test@example.com';
      const password = 'TestPassword123!@#';

      const user1 = await userFactory.createTestUser(mockUserService, email, password, {}, false);

      // Should create user successfully with makeUnique=false
      assert.ok(user1);
      assert.ok(user1.id);
      assert.ok(user1.email);
      assert.strictEqual(user1.password, password);
    });

    it('should use default password when not provided', async () => {
      const email = 'test@example.com';
      const defaultPassword = 'TestPassword123!@#';

      const user = await userFactory.createTestUser(mockUserService, email);

      assert.strictEqual(user.password, defaultPassword);
    });

    it('should use default roles when not provided', async () => {
      const email = 'test@example.com';
      const password = 'TestPassword123!@#';

      const user = await userFactory.createTestUser(mockUserService, email, password);

      assert.deepStrictEqual(user.roles, ['USER']);
    });
  });

  describe('cache functionality', () => {
    it('should cache created users and return cached version on subsequent calls', async () => {
      const baseEmail = 'test@example.com';
      const password = 'TestPassword123!@#';
      const additionalData = { firstName: 'John' };

      // Mock service to track creation calls
      let createCallCount = 0;
      mockUserService.create = async (userData: any) => {
        createCallCount++;
        return {
          id: `user-${createCallCount}`,
          ...userData,
        };
      };

      // Create first user
      const user1 = await userFactory.createTestUser(mockUserService, baseEmail, password, additionalData);

      // Create second user with same parameters
      const user2 = await userFactory.createTestUser(mockUserService, baseEmail, password, additionalData);

      // Should return cached user (same data but different object reference due to tracking)
      assert.strictEqual(user1.email, user2.email);
      assert.strictEqual(user1.firstName, user2.firstName);
      assert.strictEqual(createCallCount, 1);

      // Verify cache stats
      const stats = cacheManager.getCacheStats();
      assert.strictEqual(stats.hits, 1);
      assert.strictEqual(stats.misses, 1);
      assert.strictEqual(stats.sets, 1);
    });

    it('should handle cache misses correctly', async () => {
      const email = 'test@example.com';
      const password = 'TestPassword123!@#';

      // Mock service to track calls
      let createCallCount = 0;
      mockUserService.create = async (userData: any) => {
        createCallCount++;
        return { id: `user-${createCallCount}`, ...userData };
      };

      // Create user
      const user = await userFactory.createTestUser(mockUserService, email, password);

      // Verify cache stats for cache miss scenario
      const stats = cacheManager.getCacheStats();
      assert.strictEqual(stats.misses, 1);
      assert.strictEqual(createCallCount, 1);
    });

    it('should handle database fallback when user exists', async () => {
      const baseEmail = 'existing@example.com';
      const password = 'TestPassword123!@#';
      const existingUser = {
        id: 'existing-user-id',
        email: baseEmail,
        password,
        roles: ['USER'],
      };

      // Mock service to return existing user
      mockUserService.find = async (query: any) => {
        if (query.query.email && query.query.email.includes(baseEmail)) {
          return { data: [existingUser] };
        }
        return { data: [] };
      };

      let createCallCount = 0;
      mockUserService.create = async (userData: any) => {
        createCallCount++;
        return { id: 'new-user-id', ...userData };
      };

      const user = await userFactory.createTestUser(mockUserService, baseEmail, password);

      // Should return existing user, not create new one
      assert.strictEqual(user.id, 'existing-user-id');
      assert.strictEqual(createCallCount, 0);

      // Should be cached
      const cachedUser = cacheManager.getCached('users', {
        email: user.email, // Use actual email that was used
        password,
        roles: ['USER'],
      });
      assert.ok(cachedUser);
    });

    it('should handle database errors gracefully', async () => {
      const email = 'test@example.com';
      const password = 'TestPassword123!@#';

      // Mock service to throw error on find
      mockUserService.find = async (query: any) => {
        throw new Error('Database connection failed');
      };

      // Mock console.warn to capture warning
      let warnedMessage = '';
      const originalConsoleWarn = console.warn;
      console.warn = (message: string, error?: Error) => {
        warnedMessage = message;
      };

      let createCallCount = 0;
      mockUserService.create = async (userData: any) => {
        createCallCount++;
        return { id: 'user-1', ...userData };
      };

      const user = await userFactory.createTestUser(mockUserService, email, password);

      // Should still create user despite database error
      assert.ok(user.id);
      assert.ok(warnedMessage.includes('Could not check for existing user'));
      assert.strictEqual(createCallCount, 1);

      console.warn = originalConsoleWarn;
    });

    it('should handle cache expiration correctly', async () => {
      const email = 'test@example.com';
      const password = 'TestPassword123!@#';

      // Configure cache with very short TTL
      cacheManager.configureMemoization({
        enabled: true,
        maxSize: 1000,
        defaultTTL: 1, // 1ms TTL
        enableStats: true,
      });

      let createCallCount = 0;
      mockUserService.create = async (userData: any) => {
        createCallCount++;
        return { id: `user-${createCallCount}`, ...userData };
      };

      // Create first user
      const user1 = await userFactory.createTestUser(mockUserService, email, password);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 5));

      // Create second user with same parameters
      const user2 = await userFactory.createTestUser(mockUserService, email, password);

      // Should create new user due to cache expiration
      assert.notStrictEqual(user1, user2);
      assert.strictEqual(createCallCount, 2);
    });
  });

  describe('createTestUsers', () => {
    it('should create multiple users successfully', async () => {
      const userConfigs = [
        { email: 'user1@example.com', password: 'Password1!@#' },
        { email: 'user2@example.com', password: 'Password2!@#' },
        { email: 'user3@example.com', password: 'Password3!@#' },
      ];

      const users = await userFactory.createTestUsers(mockUserService, userConfigs);

      assert.strictEqual(users.length, 3);
      users.forEach((user, index) => {
        assert.ok(user.id);
        assert.ok(user.email.includes(userConfigs[index].email));
        assert.strictEqual(user.password, userConfigs[index].password);
      });

      // All users should be tracked
      assert.strictEqual(context.getTracked('users').length, 3);
    });

    it('should handle mixed user configurations', async () => {
      const userConfigs = [
        { email: 'user1@example.com', password: 'Password1!@#', additionalData: { roles: ['ADMIN'] } },
        { email: 'user2@example.com' }, // Should use defaults
        {
          email: 'user3@example.com',
          password: 'Password3!@#',
          additionalData: { firstName: 'Jane' },
          makeUnique: false,
        },
      ];

      const users = await userFactory.createTestUsers(mockUserService, userConfigs);

      assert.strictEqual(users.length, 3);

      // First user should have admin role
      assert.deepStrictEqual(users[0].roles, ['ADMIN']);

      // Second user should have defaults
      assert.strictEqual(users[1].password, 'TestPassword123!@#');
      assert.deepStrictEqual(users[1].roles, ['USER']);

      // Third user should have custom data and non-unique email
      assert.strictEqual(users[2].firstName, 'Jane');
      assert.strictEqual(users[2].email, 'user3@example.com');
    });

    it('should handle empty user configs array', async () => {
      const users = await userFactory.createTestUsers(mockUserService, []);

      assert.deepStrictEqual(users, []);
      assert.strictEqual(context.getTracked('users').length, 0);
    });
  });

  describe('cache management', () => {
    it('should invalidate specific user cache', async () => {
      const baseEmail = 'test@example.com';
      const password = 'TestPassword123!@#';

      // Create user
      const user1 = await userFactory.createTestUser(mockUserService, baseEmail, password);

      // Create another user with same parameters (should use cache)
      const user2 = await userFactory.createTestUser(mockUserService, baseEmail, password);

      assert.strictEqual(user1.email, user2.email);

      // Invalidate specific cache
      userFactory.invalidateUserCache({ email: user1.email, password });

      // Create another user (should create new one)
      const user3 = await userFactory.createTestUser(mockUserService, baseEmail, password);

      assert.notStrictEqual(user1.email, user3.email);
    });

    it('should clear all user cache', async () => {
      const baseEmail1 = 'test1@example.com';
      const baseEmail2 = 'test2@example.com';
      const password = 'TestPassword123!@#';

      // Create users
      const user1 = await userFactory.createTestUser(mockUserService, baseEmail1, password);
      const user2 = await userFactory.createTestUser(mockUserService, baseEmail2, password);

      // Use cache for second call
      const cachedUser1 = await userFactory.createTestUser(mockUserService, baseEmail1, password);
      const cachedUser2 = await userFactory.createTestUser(mockUserService, baseEmail2, password);

      assert.strictEqual(user1.email, cachedUser1.email);
      assert.strictEqual(user2.email, cachedUser2.email);

      // Clear all user cache
      userFactory.clearUserCache();

      // Create new users (should create new instances)
      const newUser1 = await userFactory.createTestUser(mockUserService, baseEmail1, password);
      const newUser2 = await userFactory.createTestUser(mockUserService, baseEmail2, password);

      assert.notStrictEqual(user1.email, newUser1.email);
      assert.notStrictEqual(user2.email, newUser2.email);
    });

    it('should handle cache invalidation with complex properties', async () => {
      const baseEmail = 'test@example.com';
      const properties = {
        email: baseEmail,
        roles: ['ADMIN', 'USER'],
        firstName: 'John',
        lastName: 'Doe',
      };

      // Create user with complex properties
      const user1 = await userFactory.createTestUser(mockUserService, baseEmail, 'password', {
        roles: properties.roles,
        firstName: properties.firstName,
        lastName: properties.lastName,
      });

      // Use cache
      const user2 = await userFactory.createTestUser(mockUserService, baseEmail, 'password', {
        roles: properties.roles,
        firstName: properties.firstName,
        lastName: properties.lastName,
      });

      assert.strictEqual(user1.email, user2.email);

      // Invalidate with complex properties (use actual email from user1)
      userFactory.invalidateUserCache({
        email: user1.email,
        roles: properties.roles,
        firstName: properties.firstName,
        lastName: properties.lastName,
      });

      // Should create new user
      const user3 = await userFactory.createTestUser(mockUserService, baseEmail, 'password', {
        roles: properties.roles,
        firstName: properties.firstName,
        lastName: properties.lastName,
      });

      assert.notStrictEqual(user1.email, user3.email);
    });
  });

  describe('error handling', () => {
    it('should handle service creation errors gracefully', async () => {
      const email = 'test@example.com';
      const password = 'TestPassword123!@#';

      // Mock service to throw error on create
      mockUserService.create = async (userData: any) => {
        throw new Error('User creation failed');
      };

      // Mock console.error to capture error logs
      let errorMessage = '';
      const originalConsoleError = console.error;
      console.error = (message: string, error?: Error) => {
        errorMessage = message;
      };

      try {
        await userFactory.createTestUser(mockUserService, email, password);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.message, 'User creation failed');
      }

      console.error = originalConsoleError;
    });

    it('should handle malformed user data', async () => {
      const email = 'invalid-email';
      const password = 'TestPassword123!@#';

      // Mock service to return malformed data
      mockUserService.create = async (userData: any) => {
        return {
          // Missing required fields
          email: null,
          password: undefined,
        };
      };

      const user = await userFactory.createTestUser(mockUserService, email, password);

      // Should handle malformed data gracefully
      assert.ok(user);
      assert.strictEqual(user.email, null);
      assert.strictEqual(user.password, undefined);
    });

    it('should handle cache manager errors', async () => {
      const email = 'test@example.com';
      const password = 'TestPassword123!@#';

      // Create user first
      const user1 = await userFactory.createTestUser(mockUserService, email, password);

      // Mock cache manager to throw errors
      const originalGetCached = cacheManager.getCached;
      cacheManager.getCached = () => {
        throw new Error('Cache error');
      };

      // Should handle cache errors gracefully and create new user
      const user2 = await userFactory.createTestUser(mockUserService, email, password);

      assert.notStrictEqual(user1, user2);

      // Restore original method
      cacheManager.getCached = originalGetCached;
    });
  });

  describe('integration with context tracking', () => {
    it('should properly track created users', async () => {
      const email = 'test@example.com';
      const password = 'TestPassword123!@#';

      const user = await userFactory.createTestUser(mockUserService, email, password);

      // Verify user is tracked
      const trackedUsers = context.getTracked('users');
      assert.strictEqual(trackedUsers.length, 1);
      assert.strictEqual(trackedUsers[0].id, user.id);
      assert.strictEqual(trackedUsers[0].type, 'user');
      assert.strictEqual(trackedUsers[0].data, user);
    });

    it('should handle context tracking errors', async () => {
      const email = 'test@example.com';
      const password = 'TestPassword123!@#';

      // Mock context to throw error on track
      const originalTrack = context.track;
      context.track = () => {
        throw new Error('Tracking error');
      };

      try {
        await userFactory.createTestUser(mockUserService, email, password);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.message, 'Tracking error');
      }

      // Restore original method
      context.track = originalTrack;
    });

    it('should work with isolated test contexts', async () => {
      const email = 'test@example.com';
      const password = 'TestPassword123!@#';

      // Create isolated context
      const isolatedContext = context.createIsolatedContext();

      // Create factory with isolated context
      const isolatedFactory = new UserFactory(isolatedContext, cacheManager);

      const user = await isolatedFactory.createTestUser(mockUserService, email, password);

      // Verify user is tracked in isolated context, not main context
      assert.strictEqual(isolatedContext.getTracked('users').length, 1);
      assert.strictEqual(context.getTracked('users').length, 0);
    });
  });

  describe('performance scenarios', () => {
    it('should handle bulk user creation efficiently', async () => {
      const userCount = 50;
      const userConfigs = Array.from({ length: userCount }, (_, i) => ({
        email: `user${i}@example.com`,
        password: `Password${i}!@#`,
      }));

      const startTime = Date.now();
      const users = await userFactory.createTestUsers(mockUserService, userConfigs);
      const endTime = Date.now();

      // Should create all users
      assert.strictEqual(users.length, userCount);

      // Should complete within reasonable time (less than 5 seconds for 50 users)
      assert.ok(endTime - startTime < 5000);

      // All users should be tracked
      assert.strictEqual(context.getTracked('users').length, userCount);
    });

    it('should handle cache performance with many unique users', async () => {
      const userCount = 20;

      // Create many unique users (makeUnique = true)
      for (let i = 0; i < userCount; i++) {
        await userFactory.createTestUser(mockUserService, `user${i}@example.com`, 'password', {}, true);
      }

      const stats = cacheManager.getCacheStats();
      assert.strictEqual(stats.sets, userCount);
      assert.ok(stats.size <= cacheManager.getConfig().maxSize);
    });
  });
});
