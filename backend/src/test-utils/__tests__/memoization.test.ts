import { describe, it, beforeEach, afterEach } from 'mocha';
import assert from 'assert';
import {
  TestContext,
  EnhancedTestContext,
  enhancedTestContext,
  createTestUser,
  createTestSession,
  createTestParticipant,
  createMemoizedTestUtils,
  logMemoizationPerformance,
} from '../index';
import { SessionType } from '@prisma/client';

// Mock services for testing
const mockUserService = {
  find: async (query?: any) => ({ data: [] }),
  create: async (data: any) => ({ id: 'user-1', ...data }),
  remove: async (id: string) => ({ id }),
};

const mockSessionService = {
  find: async (query?: any) => ({ data: [] }),
  create: async (data: any, params?: any) => ({ id: 'session-1', ...data }),
  remove: async (id: string) => ({ id }),
};

const mockParticipantService = {
  find: async (query?: any) => ({ data: [] }),
  create: async (data: any) => ({ id: 'participant-1', ...data }),
  remove: async (id: string) => ({ id }),
};

describe('Memoization System', () => {
  let context: TestContext;
  let enhancedContext: EnhancedTestContext;
  let memoizedUtils: ReturnType<typeof createMemoizedTestUtils>;

  beforeEach(() => {
    context = new TestContext();
    enhancedContext = enhancedTestContext;
    memoizedUtils = createMemoizedTestUtils(enhancedContext);
  });

  afterEach(() => {
    context.clearAllTracked();
    enhancedContext.clearCache();
    enhancedContext.configureMemoization({ enabled: true });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys for identical properties', () => {
      const key1 = context.generateCacheKey('users', { email: 'test@example.com', roles: ['USER'] });
      const key2 = context.generateCacheKey('users', { email: 'test@example.com', roles: ['USER'] });

      assert.strictEqual(key1, key2);
    });

    it('should generate different cache keys for different properties', () => {
      const key1 = context.generateCacheKey('users', { email: 'test@example.com', roles: ['USER'] });
      const key2 = context.generateCacheKey('users', { email: 'test@example.com', roles: ['ADMIN'] });

      assert.notStrictEqual(key1, key2);
    });

    it('should handle array normalization for consistent hashing', () => {
      const key1 = context.generateCacheKey('users', { email: 'test@example.com', roles: ['USER', 'ADMIN'] });
      const key2 = context.generateCacheKey('users', { email: 'test@example.com', roles: ['ADMIN', 'USER'] });

      assert.strictEqual(key1, key2);
    });
  });

  describe('Cache Operations', () => {
    it('should cache and retrieve users correctly', () => {
      const user = { id: 'test-user', email: 'test@example.com' };
      const properties = { email: 'test@example.com', roles: ['USER'] };

      // Initially should not be cached
      assert.strictEqual(enhancedContext.getCached('users', properties), null);

      // Cache the user
      enhancedContext.setCached('users', properties, user);

      // Should now be cached
      const cached = enhancedContext.getCached('users', properties);
      assert.deepStrictEqual(cached, user);
    });

    it('should track cache hits and misses', () => {
      const user = { id: 'test-user', email: 'test@example.com' };
      const properties = { email: 'test@example.com', roles: ['USER'] };

      // Set and get to register a hit
      enhancedContext.setCached('users', properties, user);
      enhancedContext.getCached('users', properties);

      const stats = enhancedContext.getCacheStats();
      assert.strictEqual(stats.hits, 1);
      assert.strictEqual(stats.sets, 1);
    });

    it('should handle cache expiration', (done) => {
      const user = { id: 'test-user', email: 'test@example.com' };
      const properties = { email: 'test@example.com', roles: ['USER'] };

      // Cache with very short TTL
      enhancedContext.setCached('users', properties, user, 10); // 10ms TTL

      // Should be available immediately
      assert.deepStrictEqual(enhancedContext.getCached('users', properties), user);

      // Wait for expiration
      setTimeout(() => {
        // Should be expired and removed
        assert.strictEqual(enhancedContext.getCached('users', properties), null);

        const stats = enhancedContext.getCacheStats();
        assert.strictEqual(stats.evictions, 1);

        done();
      }, 15);
    });

    it('should enforce maximum cache size', () => {
      // Configure small cache size for testing
      enhancedContext.configureMemoization({ maxSize: 2 });

      // Fill cache beyond limit
      enhancedContext.setCached('users', { email: 'user1@example.com' }, { id: '1' });
      enhancedContext.setCached('users', { email: 'user2@example.com' }, { id: '2' });
      enhancedContext.setCached('users', { email: 'user3@example.com' }, { id: '3' });

      const stats = enhancedContext.getCacheStats();
      assert.ok(stats.evictions > 0);
      assert.ok(stats.size <= 2);
    });
  });

  describe('Memoized Object Creation', () => {
    it('should cache users and reuse them', async () => {
      // Mock service to track creation calls
      let createCalls = 0;
      const userService = {
        ...mockUserService,
        create: async (data: any) => {
          createCalls++;
          return { id: `user-${createCalls}`, ...data };
        },
      };

      // Create first user
      const user1 = await createTestUser(
        userService as any,
        'test@example.com',
        'password',
        { roles: ['USER'] },
        false,
      );
      assert.strictEqual(createCalls, 1);

      // Create second user with same properties (should be cached)
      const user2 = await createTestUser(
        userService as any,
        'test@example.com',
        'password',
        { roles: ['USER'] },
        false,
      );
      assert.strictEqual(createCalls, 1); // Should not have created new user

      // Users should be the same object from cache
      assert.strictEqual(user1.id, user2.id);
    });

    it('should cache sessions and reuse them', async () => {
      let createCalls = 0;
      const sessionService = {
        ...mockSessionService,
        create: async (data: any) => {
          createCalls++;
          return { id: `session-${createCalls}`, ...data };
        },
      };

      const host = { id: 'host-1', type: 'user', data: {} };

      // Create first session
      const session1 = await createTestSession(sessionService as any, SessionType.BROADCAST, host, {
        title: 'Test Session',
      });
      assert.strictEqual(createCalls, 1);

      // Create second session with same properties (should be cached)
      const session2 = await createTestSession(sessionService as any, SessionType.BROADCAST, host, {
        title: 'Test Session',
      });
      assert.strictEqual(createCalls, 1); // Should not have created new session

      // Sessions should be the same object from cache
      assert.strictEqual(session1.id, session2.id);
    });

    it('should cache participants and reuse them', async () => {
      let createCalls = 0;
      const participantService = {
        ...mockParticipantService,
        create: async (data: any) => {
          createCalls++;
          return { id: `participant-${createCalls}`, ...data };
        },
      };

      // Create first participant
      const participant1 = await createTestParticipant(participantService as any, 'session-1', 'user-1', {
        role: 'VIEWER',
      });
      assert.strictEqual(createCalls, 1);

      // Create second participant with same properties (should be cached)
      const participant2 = await createTestParticipant(participantService as any, 'session-1', 'user-1', {
        role: 'VIEWER',
      });
      assert.strictEqual(createCalls, 1); // Should not have created new participant

      // Participants should be the same object from cache
      assert.strictEqual(participant1.id, participant2.id);
    });
  });

  describe('Cache Statistics and Monitoring', () => {
    it('should provide accurate cache statistics', () => {
      const user = { id: 'test-user', email: 'test@example.com' };
      const properties = { email: 'test@example.com', roles: ['USER'] };

      // Set and hit cache multiple times
      enhancedContext.setCached('users', properties, user);
      enhancedContext.getCached('users', properties); // Hit 1
      enhancedContext.getCached('users', properties); // Hit 2

      const stats = enhancedContext.getCacheStats();
      assert.strictEqual(stats.hits, 2);
      assert.strictEqual(stats.sets, 1);
      assert.strictEqual(stats.misses, 0);
    });

    it('should calculate hit rate correctly', () => {
      const user = { id: 'test-user', email: 'test@example.com' };
      const properties = { email: 'test@example.com', roles: ['USER'] };

      // Set and hit cache
      enhancedContext.setCached('users', properties, user);
      enhancedContext.getCached('users', properties); // Hit

      // Miss
      enhancedContext.getCached('users', { email: 'other@example.com' });

      const hitRate = enhancedContext.getHitRate();
      assert.strictEqual(hitRate, 50); // 1 hit, 1 miss = 50%
    });

    it('should log performance metrics', () => {
      const performance = logMemoizationPerformance(context);
      assert.ok(typeof performance.hitRate === 'number');
      assert.ok(performance.stats);
    });
  });

  describe('Test Isolation', () => {
    it('should create isolated contexts', () => {
      const isolatedContext = context.createIsolatedContext('test-suite-1');

      // Both contexts should have isolation keys set (original and isolated)
      assert.ok(context.getTestIsolationKey()); // Set by createIsolatedContext
      assert.ok(isolatedContext.getTestIsolationKey());

      // Should have different isolation keys
      assert.notStrictEqual(context.getTestIsolationKey(), isolatedContext.getTestIsolationKey());
    });

    it('should handle cache invalidation correctly', () => {
      const user = { id: 'test-user', email: 'test@example.com' };
      const properties = { email: 'test@example.com', roles: ['USER'] };

      enhancedContext.setCached('users', properties, user);
      assert.deepStrictEqual(enhancedContext.getCached('users', properties), user);

      // Invalidate specific entry
      enhancedContext.invalidateCache('users', properties);
      assert.strictEqual(enhancedContext.getCached('users', properties), null);
    });

    it('should handle cache clearing correctly', () => {
      const user = { id: 'test-user', email: 'test@example.com' };
      const session = { id: 'test-session', title: 'Test Session' };

      enhancedContext.setCached('users', { email: 'test@example.com' }, user);
      enhancedContext.setCached('sessions', { title: 'Test Session' }, session);

      enhancedContext.clearCache();

      const stats = enhancedContext.getCacheStats();
      assert.strictEqual(stats.size, 0);
      assert.strictEqual(stats.hits, 0);
      assert.strictEqual(stats.misses, 0);
    });
  });

  describe('Memoized Test Utils', () => {
    it('should provide enhanced utilities with performance logging', async () => {
      // This test verifies that the memoized utilities work correctly
      // and provide the same interface as the original functions
      const user = await memoizedUtils.createTestUser(
        mockUserService as any,
        'test@example.com',
        'password',
        { roles: ['USER'] },
        false,
      );

      assert.ok(user.id);
      assert.ok(user.email); // Should exist but may be different due to makeUnique logic
    });

    it('should expose cache management utilities', () => {
      assert.ok(typeof memoizedUtils.getCacheStats === 'function');
      assert.ok(typeof memoizedUtils.getHitRate === 'function');
      assert.ok(typeof memoizedUtils.clearCache === 'function');
      assert.ok(typeof memoizedUtils.configureMemoization === 'function');
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with existing TestContext usage patterns', async () => {
      // Test that existing patterns still work
      const user = await createTestUser(mockUserService as any, 'test@example.com');
      assert.ok(user);
      assert.ok(user.id);

      // Should be tracked for cleanup
      const tracked = enhancedContext.getTracked('users');
      assert.ok(tracked.length > 0);

      // Test that cache is working
      const stats = enhancedContext.getCacheStats();
      assert.ok(typeof stats.hits === 'number');
      assert.ok(typeof stats.misses === 'number');
    });

    it('should handle disabled memoization gracefully', () => {
      // Initially enabled
      const user = { id: 'test-user', email: 'test@example.com' };
      const properties = { email: 'test@example.com', roles: ['USER'] };

      // Cache when enabled
      enhancedContext.setCached('users', properties, user);
      assert.deepStrictEqual(enhancedContext.getCached('users', properties), user);

      // Disable memoization
      enhancedContext.configureMemoization({ enabled: false });

      // Should not cache when disabled
      const user2 = { id: 'test-user-2', email: 'test2@example.com' };
      enhancedContext.setCached('users', { email: 'test2@example.com' }, user2);
      assert.strictEqual(enhancedContext.getCached('users', { email: 'test2@example.com' }), null);

      // Re-enable for other tests
      enhancedContext.configureMemoization({ enabled: true });
    });
  });
});
