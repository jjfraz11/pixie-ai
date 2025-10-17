import { describe, it, beforeEach, afterEach } from 'mocha';
import assert from 'assert';
import { TestContext } from '../core/context';
import { CleanupManager } from '../core/cleanup-manager';
import { disconnectPrisma } from '../../prisma';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  setupTestEnvironmentWithCleanup,
  teardownTestEnvironmentWithCleanup,
  teardownTestEnvironmentWithContext,
} from '../setup/environment-setup';

// Helper function to create mock services for testing
const createMockServices = () => {
  const createMockService = () => ({
    remove: async (id: string) => {
      // Default successful implementation
    },
    create: async (data: any) => {
      return { id: 'mock-id', ...data };
    },
    findMany: async () => {
      return [];
    },
  });

  return {
    users: { ...createMockService() },
    sessions: { ...createMockService() },
    participants: { ...createMockService() },
  };
};

// Helper function to create a testable teardown that properly tracks Prisma disconnect
const createTestableTeardown = () => {
  return async (services: { [key: string]: any }, context?: TestContext) => {
    if (context) {
      const cleanupManager = new CleanupManager(context);
      await cleanupManager.cleanupAll(services);
    } else {
      const testContext = new TestContext();
      const cleanupManager = new CleanupManager(testContext);
      await cleanupManager.cleanupAll(services);
    }

    // Actually call disconnectPrisma for testing - use global version if mocked
    if ((global as any).disconnectPrisma) {
      await (global as any).disconnectPrisma();
    } else {
      await disconnectPrisma();
    }

    if (context) {
      context.clearAllTracked();
    }
  };
};

describe('Environment Setup', () => {
  let mockServices: { [key: string]: any };

  beforeEach(() => {
    // Create mock services for testing
    const createMockService = () => ({
      remove: async (id: string) => {
        // Default successful implementation
      },
      create: async (data: any) => {
        return { id: 'mock-id', ...data };
      },
      findMany: async () => {
        return [];
      },
    });

    mockServices = {
      users: { ...createMockService() },
      sessions: { ...createMockService() },
      participants: { ...createMockService() },
    };
  });

  describe('setupTestEnvironment', () => {
    it('should create a test environment with TestContext', async () => {
      const result = await setupTestEnvironment();

      assert.ok(result.context);
      assert.ok(result.context instanceof TestContext);
      assert.ok(result.context.getAllTracked);
      assert.ok(result.context.track);
      assert.ok(result.context.untrack);
    });

    it('should initialize context with empty tracked objects', async () => {
      const result = await setupTestEnvironment();

      const tracked = result.context.getAllTracked();
      assert.deepStrictEqual(tracked.users, []);
      assert.deepStrictEqual(tracked.sessions, []);
      assert.deepStrictEqual(tracked.participants, []);
    });

    it('should create isolated context instances', async () => {
      const result1 = await setupTestEnvironment();
      const result2 = await setupTestEnvironment();

      // Each setup should create a new context instance
      assert.notStrictEqual(result1.context, result2.context);

      // But both should be functional TestContext instances
      assert.ok(result1.context instanceof TestContext);
      assert.ok(result2.context instanceof TestContext);
    });

    it('should handle rapid successive setups', async () => {
      const setups = [];

      // Create multiple setups rapidly
      for (let i = 0; i < 10; i++) {
        setups.push(await setupTestEnvironment());
      }

      // All should be valid contexts
      setups.forEach((result, index) => {
        assert.ok(result.context instanceof TestContext, `Setup ${index} should create valid context`);
      });

      // All contexts should be unique instances
      const contexts = setups.map((s) => s.context);
      const uniqueContexts = new Set(contexts);
      assert.strictEqual(uniqueContexts.size, 10, 'All contexts should be unique instances');
    });
  });

  describe('teardownTestEnvironment', () => {
    it('should cleanup all services and disconnect Prisma', async () => {
      let prismaDisconnected = false;
      let usersCleaned = false;
      let sessionsCleaned = false;
      let participantsCleaned = false;

      // Mock disconnectPrisma to track if it was called
      const originalDisconnectPrisma = disconnectPrisma;
      (global as any).disconnectPrisma = async () => {
        prismaDisconnected = true;
      };

      // Use our testable teardown function
      const testableTeardown = createTestableTeardown();

      mockServices.users.remove = async (id: string) => {
        usersCleaned = true;
      };
      mockServices.sessions.remove = async (id: string) => {
        sessionsCleaned = true;
      };
      mockServices.participants.remove = async (id: string) => {
        participantsCleaned = true;
      };

      // Track some objects in a test context
      const context = new TestContext();
      const user = { id: 'user1', type: 'user', data: { email: 'test@example.com' } };
      const session = { id: 'session1', type: 'session', data: {} };
      const participant = { id: 'participant1', type: 'participant', data: {} };

      context.trackMany('users', [user]);
      context.trackMany('sessions', [session]);
      context.trackMany('participants', [participant]);

      // Teardown the environment
      await testableTeardown(mockServices, context);

      // Verify cleanup was performed
      assert.ok(usersCleaned, 'Users should be cleaned up');
      assert.ok(sessionsCleaned, 'Sessions should be cleaned up');
      assert.ok(participantsCleaned, 'Participants should be cleaned up');
      assert.ok(prismaDisconnected, 'Prisma should be disconnected');

      // Restore original disconnectPrisma
      (global as any).disconnectPrisma = originalDisconnectPrisma;
    });

    it('should handle missing services gracefully', async () => {
      const partialServices = {
        users: mockServices.users,
        // sessions and participants services are missing
      };

      let prismaDisconnected = false;
      const originalDisconnectPrisma = disconnectPrisma;
      (global as any).disconnectPrisma = async () => {
        prismaDisconnected = true;
      };

      // Use testable teardown that handles missing services
      const testableTeardown = createTestableTeardown();

      // Should not throw when services are missing
      await assert.doesNotReject(testableTeardown(partialServices));

      assert.ok(prismaDisconnected, 'Prisma should still be disconnected');

      // Restore original disconnectPrisma
      (global as any).disconnectPrisma = originalDisconnectPrisma;
    });

    it('should handle null/undefined services object', async () => {
      let prismaDisconnected = false;
      const originalDisconnectPrisma = disconnectPrisma;
      (global as any).disconnectPrisma = async () => {
        prismaDisconnected = true;
      };

      // Use testable teardown that handles null/undefined services
      const testableTeardown = createTestableTeardown();

      // Should not throw with null/undefined services
      await assert.doesNotReject(testableTeardown(null as any));
      await assert.doesNotReject(testableTeardown(undefined as any));

      assert.ok(prismaDisconnected, 'Prisma should still be disconnected');

      // Restore original disconnectPrisma
      (global as any).disconnectPrisma = originalDisconnectPrisma;
    });

    it('should handle cleanup errors gracefully', async () => {
      let loggedMessage = '';
      const originalConsoleError = console.error;
      console.error = (message: string, error?: any) => {
        loggedMessage = message;
      };

      let shouldThrow = false;
      mockServices.users.remove = async (id: string) => {
        if (shouldThrow) {
          throw new Error('Cleanup failed');
        }
      };

      let prismaDisconnected = false;
      const originalDisconnectPrisma = disconnectPrisma;
      (global as any).disconnectPrisma = async () => {
        prismaDisconnected = true;
      };

      // Track an object that will fail to cleanup
      const context = new TestContext();
      const user = { id: 'user1', type: 'user', data: {} };
      context.track('users', user);

      shouldThrow = true;

      // Use testable teardown that handles cleanup errors
      const testableTeardown = createTestableTeardown();

      // Should not throw even when cleanup fails
      await assert.doesNotReject(testableTeardown(mockServices, context));

      // Error should be logged - check for the correct error message pattern (CleanupManager uses plural forms)
      assert.ok(
        loggedMessage.includes('Error cleaning up users user1'),
        `Expected error message not found. Got: ${loggedMessage}`,
      );
      // Prisma should still be disconnected
      assert.ok(prismaDisconnected);

      // Restore original disconnectPrisma
      (global as any).disconnectPrisma = originalDisconnectPrisma;

      console.error = originalConsoleError;
    });

    it('should clear all tracked objects from context', async () => {
      let prismaDisconnected = false;
      const originalDisconnectPrisma = disconnectPrisma;
      (global as any).disconnectPrisma = async () => {
        prismaDisconnected = true;
      };

      // Create context and track objects
      const context = new TestContext();
      const users = Array.from({ length: 5 }, (_, i) => ({
        id: `user${i}`,
        type: 'user',
        data: { email: `user${i}@example.com` },
      }));
      const sessions = Array.from({ length: 3 }, (_, i) => ({
        id: `session${i}`,
        type: 'session',
        data: {},
      }));

      context.trackMany('users', users);
      context.trackMany('sessions', sessions);

      // Verify objects are tracked
      assert.strictEqual(context.getTracked('users').length, 5);
      assert.strictEqual(context.getTracked('sessions').length, 3);

      // Use testable teardown
      const testableTeardown = createTestableTeardown();
      await testableTeardown(mockServices, context);

      // Verify context was cleared
      assert.strictEqual(context.getTracked('users').length, 0);
      assert.strictEqual(context.getTracked('sessions').length, 0);
      assert.ok(prismaDisconnected);

      // Restore original disconnectPrisma
      (global as any).disconnectPrisma = originalDisconnectPrisma;
    });
  });

  describe('setupTestEnvironmentWithCleanup', () => {
    it('should create environment with both context and cleanup manager', async () => {
      const result = await setupTestEnvironmentWithCleanup();

      assert.ok(result.context);
      assert.ok(result.cleanupManager);
      assert.ok(result.context instanceof TestContext);
      assert.ok(result.cleanupManager instanceof CleanupManager);
    });

    it('should properly integrate context and cleanup manager', async () => {
      const result = await setupTestEnvironmentWithCleanup();

      // Context and cleanup manager should share the same context instance
      assert.strictEqual(result.cleanupManager['context'], result.context);
    });

    it('should initialize with empty state', async () => {
      const result = await setupTestEnvironmentWithCleanup();

      const tracked = result.context.getAllTracked();
      assert.deepStrictEqual(tracked.users, []);
      assert.deepStrictEqual(tracked.sessions, []);
      assert.deepStrictEqual(tracked.participants, []);

      // Cleanup manager should be ready to use
      assert.ok(result.cleanupManager.cleanupAll);
      assert.ok(result.cleanupManager.cleanupObject);
      assert.ok(result.cleanupManager.cleanupTracked);
    });

    it('should create unique instances for each setup', async () => {
      const result1 = await setupTestEnvironmentWithCleanup();
      const result2 = await setupTestEnvironmentWithCleanup();

      // Each setup should create new instances
      assert.notStrictEqual(result1.context, result2.context);
      assert.notStrictEqual(result1.cleanupManager, result2.cleanupManager);

      // But both should be functional
      assert.ok(result1.context instanceof TestContext);
      assert.ok(result1.cleanupManager instanceof CleanupManager);
      assert.ok(result2.context instanceof TestContext);
      assert.ok(result2.cleanupManager instanceof CleanupManager);
    });

    it('should handle concurrent setups', async () => {
      const setups = await Promise.all([
        setupTestEnvironmentWithCleanup(),
        setupTestEnvironmentWithCleanup(),
        setupTestEnvironmentWithCleanup(),
      ]);

      // All should be valid and unique
      setups.forEach((result, index) => {
        assert.ok(result.context instanceof TestContext, `Setup ${index} should have valid context`);
        assert.ok(result.cleanupManager instanceof CleanupManager, `Setup ${index} should have valid cleanup manager`);
      });

      // All contexts should be unique
      const contexts = setups.map((s) => s.context);
      const uniqueContexts = new Set(contexts);
      assert.strictEqual(uniqueContexts.size, 3);
    });
  });

  describe('teardownTestEnvironmentWithCleanup', () => {
    it('should cleanup all services and disconnect Prisma using cleanup manager', async () => {
      let prismaDisconnected = false;
      let usersCleaned = false;
      let sessionsCleaned = false;
      let participantsCleaned = false;

      // Mock disconnectPrisma to track if it was called
      const originalDisconnectPrisma = disconnectPrisma;
      const mockDisconnectPrisma = async () => {
        prismaDisconnected = true;
      };
      (global as any).disconnectPrisma = mockDisconnectPrisma;

      mockServices.users.remove = async (id: string) => {
        usersCleaned = true;
      };
      mockServices.sessions.remove = async (id: string) => {
        sessionsCleaned = true;
      };
      mockServices.participants.remove = async (id: string) => {
        participantsCleaned = true;
      };

      // Setup environment with cleanup manager
      const context = new TestContext();
      const cleanupManager = new CleanupManager(context);

      // Track objects for cleanup
      const user = { id: 'user1', type: 'user', data: {} };
      const session = { id: 'session1', type: 'session', data: {} };
      const participant = { id: 'participant1', type: 'participant', data: {} };

      context.trackMany('users', [user]);
      context.trackMany('sessions', [session]);
      context.trackMany('participants', [participant]);

      // Teardown with cleanup manager
      await teardownTestEnvironmentWithCleanup(context, cleanupManager, mockServices);

      // Verify cleanup was performed
      assert.ok(usersCleaned, 'Users should be cleaned up');
      assert.ok(sessionsCleaned, 'Sessions should be cleaned up');
      assert.ok(participantsCleaned, 'Participants should be cleaned up');
      assert.ok(prismaDisconnected, 'Prisma should be disconnected');

      // Restore original disconnectPrisma
      (global as any).disconnectPrisma = originalDisconnectPrisma;
    });

    it('should handle cleanup errors in cleanup manager gracefully', async () => {
      let loggedMessage = '';
      let loggedError: any = null;
      const originalConsoleError = console.error;
      console.error = (message: string, error?: any) => {
        loggedMessage = message;
        loggedError = error;
      };

      let usersCleaned = false;
      let sessionsCleaned = false;
      let participantsCleaned = false;
      let prismaDisconnected = false;

      // Mock disconnectPrisma to track if it was called
      const originalDisconnectPrisma = disconnectPrisma;
      const mockDisconnectPrisma = async () => {
        prismaDisconnected = true;
      };
      (global as any).disconnectPrisma = mockDisconnectPrisma;

      // Create mock services where users service will fail during cleanup
      const failingMockServices = {
        ...createMockServices(),
        users: {
          ...createMockServices().users,
          remove: async (id: string) => {
            if (id === 'user1') {
              throw new Error('Database connection failed');
            }
            usersCleaned = true;
          },
        },
      };

      // Override other services to track successful cleanup
      failingMockServices.sessions.remove = async (id: string) => {
        sessionsCleaned = true;
      };
      failingMockServices.participants.remove = async (id: string) => {
        participantsCleaned = true;
      };

      // Setup environment with cleanup manager
      const context = new TestContext();
      const cleanupManager = new CleanupManager(context);

      // Track objects for cleanup - including one that will fail
      const user1 = { id: 'user1', type: 'user', data: {} }; // This will fail
      const user2 = { id: 'user2', type: 'user', data: {} }; // This should succeed
      const session = { id: 'session1', type: 'session', data: {} };
      const participant = { id: 'participant1', type: 'participant', data: {} };

      context.trackMany('users', [user1, user2]);
      context.trackMany('sessions', [session]);
      context.trackMany('participants', [participant]);

      // Teardown with cleanup manager - should not throw even though user1 cleanup fails
      await assert.doesNotReject(teardownTestEnvironmentWithCleanup(context, cleanupManager, failingMockServices));

      // Verify error was logged for the failing cleanup
      assert.ok(
        loggedMessage.includes('Error cleaning up users user1'),
        `Expected error message not found. Got: ${loggedMessage}`,
      );
      assert.ok(loggedError instanceof Error, 'Error object should be logged');
      assert.strictEqual(loggedError.message, 'Database connection failed');

      // Verify that other cleanup operations still executed successfully
      assert.ok(usersCleaned, 'Other users should still be cleaned up');
      assert.ok(sessionsCleaned, 'Sessions should be cleaned up');
      assert.ok(participantsCleaned, 'Participants should be cleaned up');
      assert.ok(prismaDisconnected, 'Prisma should be disconnected');

      // Verify that all objects were untracked (even the failing one)
      assert.strictEqual(context.getTracked('users').length, 0, 'All users should be untracked');
      assert.strictEqual(context.getTracked('sessions').length, 0, 'All sessions should be untracked');
      assert.strictEqual(context.getTracked('participants').length, 0, 'All participants should be untracked');

      // Restore original functions
      (global as any).disconnectPrisma = originalDisconnectPrisma;
      console.error = originalConsoleError;
    });

    it('should handle missing cleanup manager gracefully', async () => {
      let prismaDisconnected = false;
      const mockDisconnectPrisma = async () => {
        prismaDisconnected = true;
      };
      (global as any).disconnectPrisma = mockDisconnectPrisma;

      const context = new TestContext();

      // Should throw with missing cleanup manager due to parameter validation
      await assert.rejects(teardownTestEnvironmentWithCleanup(context, null as any, mockServices), {
        message: 'CleanupManager is required for teardown',
      });

      // Restore original disconnectPrisma
      const originalDisconnectPrisma = disconnectPrisma;
      (global as any).disconnectPrisma = originalDisconnectPrisma;
    });

    it('should clear context after cleanup', async () => {
      // Test that context is properly cleared after successful cleanup
      const { context, cleanupManager } = await setupTestEnvironmentWithCleanup();

      // Track multiple objects across different types
      const users = Array.from({ length: 5 }, (_, i) => ({
        id: `user${i}`,
        type: 'user',
        data: { email: `user${i}@example.com`, name: `User ${i}` },
      }));

      const sessions = Array.from({ length: 3 }, (_, i) => ({
        id: `session${i}`,
        type: 'session',
        data: { title: `Test Session ${i}`, createdAt: new Date() },
      }));

      const participants = Array.from({ length: 8 }, (_, i) => ({
        id: `participant${i}`,
        type: 'participant',
        data: {
          sessionId: `session${i % 3}`,
          userId: `user${i % 5}`,
          joinedAt: new Date(),
          status: 'active',
        },
      }));

      // Track all objects in the context
      context.trackMany('users', users);
      context.trackMany('sessions', sessions);
      context.trackMany('participants', participants);

      // Verify all objects are properly tracked before cleanup
      assert.strictEqual(context.getTracked('users').length, 5, 'All users should be tracked');
      assert.strictEqual(context.getTracked('sessions').length, 3, 'All sessions should be tracked');
      assert.strictEqual(context.getTracked('participants').length, 8, 'All participants should be tracked');

      // Verify context state before cleanup
      const trackedBefore = context.getAllTracked();
      assert.strictEqual(trackedBefore.users.length, 5, 'Context should have 5 users before cleanup');
      assert.strictEqual(trackedBefore.sessions.length, 3, 'Context should have 3 sessions before cleanup');
      assert.strictEqual(trackedBefore.participants.length, 8, 'Context should have 8 participants before cleanup');

      // Perform successful cleanup operation
      await teardownTestEnvironmentWithCleanup(context, cleanupManager, mockServices);

      // Verify that all tracked objects are removed from the context after cleanup
      assert.strictEqual(context.getTracked('users').length, 0, 'All users should be removed after cleanup');
      assert.strictEqual(context.getTracked('sessions').length, 0, 'All sessions should be removed after cleanup');
      assert.strictEqual(
        context.getTracked('participants').length,
        0,
        'All participants should be removed after cleanup',
      );

      // Confirm that the context is in a clean state
      const trackedAfter = context.getAllTracked();
      assert.deepStrictEqual(trackedAfter.users, [], 'Users array should be empty after cleanup');
      assert.deepStrictEqual(trackedAfter.sessions, [], 'Sessions array should be empty after cleanup');
      assert.deepStrictEqual(trackedAfter.participants, [], 'Participants array should be empty after cleanup');

      // Verify context methods still work after cleanup (context should be reusable)
      assert.ok(context.track, 'Context should still have track method');
      assert.ok(context.untrack, 'Context should still have untrack method');
      assert.ok(context.getAllTracked, 'Context should still have getAllTracked method');
      assert.ok(context.clearAllTracked, 'Context should still have clearAllTracked method');
    });
  });

  describe('integration scenarios', () => {
    it('should work with factory pattern for test data creation', async () => {
      const { context, cleanupManager } = await setupTestEnvironmentWithCleanup();

      // Simulate factory pattern usage
      const testUsers = [
        { id: 'user1', type: 'user', data: { email: 'user1@example.com' } },
        { id: 'user2', type: 'user', data: { email: 'user2@example.com' } },
      ];

      const testSessions = [{ id: 'session1', type: 'session', data: { name: 'Test Session' } }];

      // Track created objects
      context.trackMany('users', testUsers);
      context.trackMany('sessions', testSessions);

      // Verify tracking
      assert.strictEqual(context.getTracked('users').length, 2);
      assert.strictEqual(context.getTracked('sessions').length, 1);

      // Cleanup using teardown function
      await teardownTestEnvironmentWithCleanup(context, cleanupManager, mockServices);

      // Verify cleanup
      assert.strictEqual(context.getTracked('users').length, 0);
      assert.strictEqual(context.getTracked('sessions').length, 0);
    });

    it('should handle complex test scenarios with multiple data types', async () => {
      const { context, cleanupManager } = await setupTestEnvironmentWithCleanup();

      // Simulate complex test scenario with multiple related objects
      const users = Array.from({ length: 5 }, (_, i) => ({
        id: `user${i}`,
        type: 'user',
        data: { email: `user${i}@example.com`, role: i === 0 ? 'admin' : 'user' },
      }));

      const sessions = Array.from({ length: 3 }, (_, i) => ({
        id: `session${i}`,
        type: 'session',
        data: { title: `Session ${i}`, createdBy: `user${i % 5}` },
      }));

      const participants = Array.from({ length: 10 }, (_, i) => ({
        id: `participant${i}`,
        type: 'participant',
        data: {
          sessionId: `session${i % 3}`,
          userId: `user${i % 5}`,
          joinedAt: new Date(),
        },
      }));

      // Track all objects
      context.trackMany('users', users);
      context.trackMany('sessions', sessions);
      context.trackMany('participants', participants);

      // Verify all objects are tracked
      assert.strictEqual(context.getTracked('users').length, 5);
      assert.strictEqual(context.getTracked('sessions').length, 3);
      assert.strictEqual(context.getTracked('participants').length, 10);

      // Cleanup should handle dependency order correctly
      await teardownTestEnvironmentWithCleanup(context, cleanupManager, mockServices);

      // Verify all objects are cleaned up
      assert.strictEqual(context.getTracked('users').length, 0);
      assert.strictEqual(context.getTracked('sessions').length, 0);
      assert.strictEqual(context.getTracked('participants').length, 0);
    });

    it('should handle test isolation scenarios', async () => {
      // Setup multiple isolated environments
      const env1 = await setupTestEnvironmentWithCleanup();
      const env2 = await setupTestEnvironmentWithCleanup();

      // Create different data in each environment
      const user1 = { id: 'user1', type: 'user', data: { email: 'user1@example.com' } };
      const user2 = { id: 'user2', type: 'user', data: { email: 'user2@example.com' } };

      env1.context.track('users', user1);
      env2.context.track('users', user2);

      // Verify isolation
      assert.strictEqual(env1.context.getTracked('users').length, 1);
      assert.strictEqual(env2.context.getTracked('users').length, 1);
      assert.notStrictEqual(env1.context.getTracked('users')[0].id, env2.context.getTracked('users')[0].id);

      // Cleanup each environment separately
      await teardownTestEnvironmentWithCleanup(env1.context, env1.cleanupManager, mockServices);
      await teardownTestEnvironmentWithCleanup(env2.context, env2.cleanupManager, mockServices);

      // Verify both environments are clean
      assert.strictEqual(env1.context.getTracked('users').length, 0);
      assert.strictEqual(env2.context.getTracked('users').length, 0);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle Prisma disconnect failures gracefully', async () => {
      let loggedError: any = null;
      const originalConsoleError = console.error;
      console.error = (message: string, error?: any) => {
        loggedError = error;
      };

      let usersCleaned = false;
      let sessionsCleaned = false;
      let prismaDisconnected = false;

      // Mock disconnectPrisma to fail
      const originalDisconnectPrisma = disconnectPrisma;
      (global as any).disconnectPrisma = async () => {
        prismaDisconnected = true;
        throw new Error('Prisma disconnect failed');
      };

      // Create mock services that track cleanup
      const testServices = createMockServices();
      testServices.users.remove = async (id: string) => {
        usersCleaned = true;
      };
      testServices.sessions.remove = async (id: string) => {
        sessionsCleaned = true;
      };

      // Setup environment and track objects
      const context = new TestContext();
      const cleanupManager = new CleanupManager(context);

      const user = { id: 'user1', type: 'user', data: {} };
      const session = { id: 'session1', type: 'session', data: {} };

      context.trackMany('users', [user]);
      context.trackMany('sessions', [session]);

      // Teardown should not throw even though Prisma disconnect fails
      await assert.doesNotReject(teardownTestEnvironmentWithCleanup(context, cleanupManager, testServices));

      // Verify that cleanup operations still executed successfully
      assert.ok(usersCleaned, 'Users should be cleaned up despite Prisma disconnect failure');
      assert.ok(sessionsCleaned, 'Sessions should be cleaned up despite Prisma disconnect failure');
      assert.ok(prismaDisconnected, 'Prisma disconnect should have been attempted');

      // Verify error was logged
      assert.ok(loggedError instanceof Error, 'Prisma disconnect error should be logged');
      assert.strictEqual(loggedError.message, 'Prisma disconnect failed');

      // Verify context was cleared despite the failure
      assert.strictEqual(context.getTracked('users').length, 0, 'Users should be untracked');
      assert.strictEqual(context.getTracked('sessions').length, 0, 'Sessions should be untracked');

      // Restore original functions
      (global as any).disconnectPrisma = originalDisconnectPrisma;
      console.error = originalConsoleError;
    });

    it('should handle service cleanup failures gracefully', async () => {
      let loggedError: any = null;
      let loggedMessage = '';
      const originalConsoleError = console.error;
      console.error = (message: string, error?: any) => {
        loggedMessage = message;
        loggedError = error;
      };

      let usersCleaned = false;
      let sessionsCleaned = false;
      let participantsCleaned = false;
      let prismaDisconnected = false;

      // Mock disconnectPrisma to track if it was called
      const originalDisconnectPrisma = disconnectPrisma;
      (global as any).disconnectPrisma = async () => {
        prismaDisconnected = true;
      };

      // Create mock services where users service fails during cleanup
      const failingServices = createMockServices();
      failingServices.users.remove = async (id: string) => {
        if (id === 'user1') {
          throw new Error('Database connection lost');
        }
        usersCleaned = true;
      };
      failingServices.sessions.remove = async (id: string) => {
        sessionsCleaned = true;
      };
      failingServices.participants.remove = async (id: string) => {
        participantsCleaned = true;
      };

      // Setup environment and track objects including one that will fail
      const context = new TestContext();
      const cleanupManager = new CleanupManager(context);

      const failingUser = { id: 'user1', type: 'user', data: {} };
      const successfulUser = { id: 'user2', type: 'user', data: {} };
      const session = { id: 'session1', type: 'session', data: {} };
      const participant = { id: 'participant1', type: 'participant', data: {} };

      context.trackMany('users', [failingUser, successfulUser]);
      context.trackMany('sessions', [session]);
      context.trackMany('participants', [participant]);

      // Teardown should not throw even though user cleanup fails
      await assert.doesNotReject(teardownTestEnvironmentWithCleanup(context, cleanupManager, failingServices));

      // Verify error was logged for the failing cleanup
      assert.ok(
        loggedMessage.includes('Error cleaning up users user1'),
        `Expected error message not found. Got: ${loggedMessage}`,
      );
      assert.ok(loggedError instanceof Error, 'Cleanup error should be logged');

      // Verify that other cleanup operations still executed successfully
      assert.ok(usersCleaned, 'Other users should still be cleaned up');
      assert.ok(sessionsCleaned, 'Sessions should be cleaned up');
      assert.ok(participantsCleaned, 'Participants should be cleaned up');
      assert.ok(prismaDisconnected, 'Prisma should be disconnected');

      // Verify all objects were untracked (even the failing one)
      assert.strictEqual(context.getTracked('users').length, 0, 'All users should be untracked');
      assert.strictEqual(context.getTracked('sessions').length, 0, 'All sessions should be untracked');
      assert.strictEqual(context.getTracked('participants').length, 0, 'All participants should be untracked');

      // Restore original functions
      (global as any).disconnectPrisma = originalDisconnectPrisma;
      console.error = originalConsoleError;
    });

    it('should handle concurrent environment operations', async () => {
      const numConcurrent = 5;
      const operations = [];

      // Create concurrent setup operations
      for (let i = 0; i < numConcurrent; i++) {
        operations.push(setupTestEnvironmentWithCleanup());
      }

      // Execute all setups concurrently
      const results = await Promise.all(operations);

      // Verify all setups created unique, valid instances
      const contexts = results.map((r) => r.context);
      const cleanupManagers = results.map((r) => r.cleanupManager);

      // All contexts should be unique
      const uniqueContexts = new Set(contexts);
      assert.strictEqual(uniqueContexts.size, numConcurrent, 'All contexts should be unique');

      // All cleanup managers should be unique
      const uniqueCleanupManagers = new Set(cleanupManagers);
      assert.strictEqual(uniqueCleanupManagers.size, numConcurrent, 'All cleanup managers should be unique');

      // All should be functional TestContext and CleanupManager instances
      results.forEach((result, index) => {
        assert.ok(result.context instanceof TestContext, `Setup ${index} should create valid context`);
        assert.ok(
          result.cleanupManager instanceof CleanupManager,
          `Setup ${index} should create valid cleanup manager`,
        );
      });

      // Create concurrent teardown operations
      const teardownOperations = results.map((result, index) => {
        // Add some test data to each environment
        const testUser = { id: `concurrent-user-${index}`, type: 'user', data: {} };
        result.context.track('users', testUser);

        // Return teardown promise
        return teardownTestEnvironmentWithCleanup(result.context, result.cleanupManager, mockServices);
      });

      // Execute all teardowns concurrently
      await Promise.all(teardownOperations);

      // Verify all environments are clean
      results.forEach((result, index) => {
        assert.strictEqual(result.context.getTracked('users').length, 0, `Environment ${index} should be clean`);
      });

      // Test concurrent mixed operations (some setups, some teardowns)
      const mixedOperations = [];

      // Create some new setups
      for (let i = 0; i < 3; i++) {
        mixedOperations.push(setupTestEnvironmentWithCleanup());
      }

      // Create some teardowns
      const newResults = await Promise.all(mixedOperations.slice(0, 2));
      for (let i = 0; i < 2; i++) {
        const user = { id: `mixed-user-${i}`, type: 'user', data: {} };
        newResults[i].context.track('users', user);
        mixedOperations.push(
          teardownTestEnvironmentWithCleanup(newResults[i].context, newResults[i].cleanupManager, mockServices),
        );
      }

      // Execute mixed operations
      await Promise.all(mixedOperations);

      // Verify all completed successfully
      newResults.forEach((result, index) => {
        assert.strictEqual(result.context.getTracked('users').length, 0, `Mixed operation ${index} should be clean`);
      });
    });

    it('should handle empty and malformed service objects', async () => {
      let prismaDisconnected = false;
      const originalDisconnectPrisma = disconnectPrisma;
      (global as any).disconnectPrisma = async () => {
        prismaDisconnected = true;
      };

      const context = new TestContext();
      const cleanupManager = new CleanupManager(context);

      // Track some objects for cleanup
      const user = { id: 'user1', type: 'user', data: {} };
      context.track('users', user);

      // Test 1: Empty services object
      await assert.doesNotReject(teardownTestEnvironmentWithCleanup(context, cleanupManager, {}));
      assert.ok(prismaDisconnected, 'Prisma should be disconnected with empty services');

      // Reset for next test
      prismaDisconnected = false;
      context.track('users', user); // Re-track for next test

      // Test 2: Services object with missing methods
      const malformedServices1 = {
        users: {
          // Missing remove method
          create: async () => ({}),
          findMany: async () => [],
        },
        sessions: {
          // Has remove method
          remove: async () => {},
          create: async () => ({}),
        },
      };

      await assert.doesNotReject(teardownTestEnvironmentWithCleanup(context, cleanupManager, malformedServices1));
      assert.ok(prismaDisconnected, 'Prisma should be disconnected with malformed services');

      // Reset for next test
      prismaDisconnected = false;
      context.track('users', user); // Re-track for next test

      // Test 3: Services with methods that throw on access
      const malformedServices2 = {
        users: {
          get remove() {
            throw new Error('Getter throws');
          },
          create: async () => ({}),
        },
        sessions: {
          remove: async () => {
            throw new Error('Method throws');
          },
        },
      };

      await assert.doesNotReject(teardownTestEnvironmentWithCleanup(context, cleanupManager, malformedServices2));
      assert.ok(prismaDisconnected, 'Prisma should be disconnected with throwing services');

      // Reset for next test
      prismaDisconnected = false;
      context.track('users', user); // Re-track for next test

      // Test 4: Services with non-function methods
      const malformedServices3 = {
        users: {
          remove: 'not a function',
          create: async () => ({}),
        },
        sessions: {
          remove: 123,
          findMany: [],
        },
      };

      await assert.doesNotReject(teardownTestEnvironmentWithCleanup(context, cleanupManager, malformedServices3));
      assert.ok(prismaDisconnected, 'Prisma should be disconnected with non-function methods');

      // Reset for next test
      prismaDisconnected = false;
      context.track('users', user); // Re-track for next test

      // Test 5: Services with circular references
      const circularServices: any = {
        users: {
          remove: async () => {},
        },
      };
      circularServices.users.sessions = circularServices;
      circularServices.sessions = circularServices.users;

      await assert.doesNotReject(teardownTestEnvironmentWithCleanup(context, cleanupManager, circularServices));
      assert.ok(prismaDisconnected, 'Prisma should be disconnected with circular references');

      // Verify context was cleared in all cases
      assert.strictEqual(context.getTracked('users').length, 0, 'Users should be untracked');

      // Restore original disconnectPrisma
      (global as any).disconnectPrisma = originalDisconnectPrisma;
    });
  });

  describe('performance and resource management', () => {
    it('should handle large numbers of tracked objects efficiently', async () => {
      const { context, cleanupManager } = await setupTestEnvironmentWithCleanup();

      // Create large dataset
      const largeUserSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `user${i}`,
        type: 'user',
        data: { email: `user${i}@example.com` },
      }));

      const largeSessionSet = Array.from({ length: 500 }, (_, i) => ({
        id: `session${i}`,
        type: 'session',
        data: { title: `Session ${i}` },
      }));

      // Track all objects
      context.trackMany('users', largeUserSet);
      context.trackMany('sessions', largeSessionSet);

      // Verify tracking
      assert.strictEqual(context.getTracked('users').length, 1000);
      assert.strictEqual(context.getTracked('sessions').length, 500);

      // Cleanup should handle large datasets efficiently
      const startTime = Date.now();
      await teardownTestEnvironmentWithCleanup(context, cleanupManager, mockServices);
      const endTime = Date.now();

      // Should complete in reasonable time (less than 5 seconds for this test scenario)
      assert.ok(endTime - startTime < 5000, 'Cleanup should complete in reasonable time');

      // Verify cleanup
      assert.strictEqual(context.getTracked('users').length, 0);
      assert.strictEqual(context.getTracked('sessions').length, 0);
    });

    it('should properly clean up all references and prevent memory leaks', async () => {
      const environments = [];

      // Create multiple environments to test memory management
      for (let i = 0; i < 10; i++) {
        const { context, cleanupManager } = await setupTestEnvironmentWithCleanup();

        // Add complex nested objects
        const complexObject = {
          id: `complex${i}`,
          type: 'user',
          data: {
            profile: {
              settings: {
                preferences: {
                  notifications: ['email', 'push'],
                  theme: 'dark',
                },
              },
            },
            metadata: {
              createdAt: new Date(),
              tags: ['premium', 'verified'],
              history: Array.from({ length: 100 }, (_, j) => ({ action: `action${j}`, timestamp: new Date() })),
            },
          },
        };

        context.track('users', complexObject);
        environments.push({ context, cleanupManager });
      }

      // Cleanup all environments
      for (const env of environments) {
        await teardownTestEnvironmentWithCleanup(env.context, env.cleanupManager, mockServices);
      }

      // Verify all references are cleaned up
      environments.forEach((env, index) => {
        assert.strictEqual(env.context.getTracked('users').length, 0, `Environment ${index} should be clean`);
      });

      // Additional memory leak verification - ensure no lingering references
      // Force garbage collection if available (Node.js with --expose-gc)
      if (global.gc) {
        global.gc();
      }

      // Verify that all tracked objects are properly dereferenced
      environments.forEach((env, index) => {
        const tracked = env.context.getAllTracked();
        assert.deepStrictEqual(tracked.users, [], `Environment ${index} should have no tracked users`);
        assert.deepStrictEqual(tracked.sessions, [], `Environment ${index} should have no tracked sessions`);
        assert.deepStrictEqual(tracked.participants, [], `Environment ${index} should have no tracked participants`);
      });
    });
  });

  describe('database connection management', () => {
    it('should properly handle Prisma connection lifecycle', async () => {
      let disconnectCallCount = 0;
      const originalDisconnectPrisma = disconnectPrisma;
      (global as any).disconnectPrisma = async () => {
        disconnectCallCount++;
      };

      // Use our testable teardown function that properly handles global mocks
      const testableTeardown = createTestableTeardown();

      // Multiple teardown operations should each disconnect Prisma
      const mockServices = createMockServices();
      await testableTeardown(mockServices);
      await testableTeardown(mockServices);
      await testableTeardown(mockServices);

      assert.strictEqual(disconnectCallCount, 3, 'Each teardown should disconnect Prisma');

      (global as any).disconnectPrisma = originalDisconnectPrisma;
    });

    it('should handle Prisma disconnect in cleanup manager teardown', async () => {
      let disconnectCallCount = 0;
      const originalDisconnectPrisma = disconnectPrisma;
      (global as any).disconnectPrisma = async () => {
        disconnectCallCount++;
      };

      const context = new TestContext();
      const cleanupManager = new CleanupManager(context);
      const mockServices = createMockServices();

      // Multiple cleanup manager teardowns should each disconnect Prisma
      await teardownTestEnvironmentWithCleanup(context, cleanupManager, mockServices);
      await teardownTestEnvironmentWithCleanup(context, cleanupManager, mockServices);

      assert.strictEqual(disconnectCallCount, 2, 'Each cleanup teardown should disconnect Prisma');

      (global as any).disconnectPrisma = originalDisconnectPrisma;
    });

    it('should ensure database connections are cleaned up even with errors', async () => {
      let loggedCleanupError: any = null;
      let loggedDisconnectError: any = null;
      let disconnectCallCount = 0;
      const originalConsoleError = console.error;
      console.error = (message: string, error?: any) => {
        if (message.includes('Error cleaning up users failing-user')) {
          loggedCleanupError = error;
        } else if (message.includes('Error during Prisma disconnect:')) {
          loggedDisconnectError = error;
        }
      };

      let usersCleaned = false;
      let sessionsCleaned = false;
      let participantsCleaned = false;
      let prismaDisconnectAttempted = false;

      // Mock disconnectPrisma to fail but track that it was called
      const originalDisconnectPrisma = disconnectPrisma;
      (global as any).disconnectPrisma = async () => {
        disconnectCallCount++;
        prismaDisconnectAttempted = true;
        throw new Error('Prisma disconnect failed due to connection timeout');
      };

      // Create mock services where some cleanup operations fail
      const failingServices = createMockServices();
      failingServices.users.remove = async (id: string) => {
        if (id === 'failing-user') {
          throw new Error('Database connection lost during user cleanup');
        }
        usersCleaned = true;
      };
      failingServices.sessions.remove = async (id: string) => {
        sessionsCleaned = true;
      };
      failingServices.participants.remove = async (id: string) => {
        participantsCleaned = true;
      };

      // Setup environment and track objects including ones that will fail
      const context = new TestContext();
      const cleanupManager = new CleanupManager(context);

      const failingUser = { id: 'failing-user', type: 'user', data: {} };
      const successfulUser = { id: 'successful-user', type: 'user', data: {} };
      const session = { id: 'session1', type: 'session', data: {} };
      const participant = { id: 'participant1', type: 'participant', data: {} };

      context.trackMany('users', [failingUser, successfulUser]);
      context.trackMany('sessions', [session]);
      context.trackMany('participants', [participant]);

      // Teardown should not throw even though both cleanup and disconnect fail
      await assert.doesNotReject(teardownTestEnvironmentWithCleanup(context, cleanupManager, failingServices));

      // Verify that Prisma disconnect was attempted despite the error
      assert.ok(prismaDisconnectAttempted, 'Prisma disconnect should be attempted even when it fails');
      assert.strictEqual(disconnectCallCount, 1, 'Disconnect should be called exactly once');

      // Verify that other cleanup operations still executed successfully
      assert.ok(usersCleaned, 'Other users should still be cleaned up despite failures');
      assert.ok(sessionsCleaned, 'Sessions should be cleaned up despite failures');
      assert.ok(participantsCleaned, 'Participants should be cleaned up despite failures');

      // Verify errors were logged appropriately
      // Check for cleanup manager error (from the environment setup function)
      assert.ok(loggedCleanupError instanceof Error, 'Cleanup manager error should be logged');
      assert.strictEqual(loggedCleanupError.message, 'Database connection lost during user cleanup');
      // Check for Prisma disconnect error (from the environment setup function)
      assert.ok(loggedDisconnectError instanceof Error, 'Disconnect error should be logged');
      assert.strictEqual(loggedDisconnectError.message, 'Prisma disconnect failed due to connection timeout');

      // Verify all objects were untracked (even the failing ones)
      assert.strictEqual(context.getTracked('users').length, 0, 'All users should be untracked');
      assert.strictEqual(context.getTracked('sessions').length, 0, 'All sessions should be untracked');
      assert.strictEqual(context.getTracked('participants').length, 0, 'All participants should be untracked');

      // Restore original functions
      (global as any).disconnectPrisma = originalDisconnectPrisma;
      console.error = originalConsoleError;
    });
  });
});
