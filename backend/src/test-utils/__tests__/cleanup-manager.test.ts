import { describe, it, beforeEach, afterEach } from 'mocha';
import assert from 'assert';
import { TestContext, testContext } from '../core/context';
import { CleanupManager } from '../core/cleanup-manager';
import { EnhancedTestContext } from '../index';

describe('CleanupManager', () => {
  let context: TestContext;
  let cleanupManager: CleanupManager;
  let mockServices: { [key: string]: any };

  beforeEach(() => {
    context = new TestContext();
    cleanupManager = new CleanupManager(context);

    // Create mock services
    const createMockService = () => ({
      remove: async (id: string) => {
        // Default successful implementation
      },
      removeSync: (id: string) => {
        // Default successful implementation
      },
    });

    mockServices = {
      users: { ...createMockService(), remove: async (id: string) => {} },
      sessions: { ...createMockService(), remove: async (id: string) => {} },
      participants: { ...createMockService(), remove: async (id: string) => {} },
    };
  });

  afterEach(() => {
    context.clearAllTracked();
  });

  describe('cleanupObject', () => {
    it('should successfully cleanup an object', async () => {
      const mockUserService = mockServices.users;
      let removeCalledWith = '';
      mockUserService.remove = async (id: string) => {
        removeCalledWith = id;
      };

      // Track a user object
      const user = { id: 'user1', type: 'user', data: { email: 'test@example.com' } };
      context.track('users', user);

      // Cleanup the object
      await cleanupManager.cleanupObject('users', 'user1', mockUserService);

      // Verify service.remove was called
      assert.strictEqual(removeCalledWith, 'user1');
      // Verify object was untracked
      assert.strictEqual(context.getTracked('users').length, 0);
    });

    it('should handle cleanup with missing service gracefully', async () => {
      const user = { id: 'user1', type: 'user', data: { email: 'test@example.com' } };
      context.track('users', user);

      // Should not throw error when service is null/undefined
      await cleanupManager.cleanupObject('users', 'user1', null);
      await cleanupManager.cleanupObject('users', 'user1', undefined);

      // Object should still be tracked since cleanup was skipped
      assert.strictEqual(context.getTracked('users').length, 1);
    });

    it('should handle cleanup with missing id gracefully', async () => {
      const mockUserService = mockServices.users;
      let removeCallCount = 0;
      mockUserService.remove = async (id: string) => {
        removeCallCount++;
      };

      // Should not throw error when id is null/undefined/empty
      await cleanupManager.cleanupObject('users', null as any, mockUserService);
      await cleanupManager.cleanupObject('users', undefined as any, mockUserService);
      await cleanupManager.cleanupObject('users', '', mockUserService);

      // Service should not be called
      assert.strictEqual(removeCallCount, 0);
    });

    it('should handle and log cleanup errors without throwing', async () => {
      const mockUserService = mockServices.users;
      let removeCalled = false;
      mockUserService.remove = async (id: string) => {
        removeCalled = true;
        throw new Error('Cleanup failed');
      };

      // Mock console.error to capture error logs
      let loggedMessage = '';
      const originalConsoleError = console.error;
      console.error = (message: string, error?: Error) => {
        loggedMessage = message;
      };

      const user = { id: 'user1', type: 'user', data: { email: 'test@example.com' } };
      context.track('users', user);

      // Should not throw error even when cleanup fails
      await assert.doesNotReject(cleanupManager.cleanupObject('users', 'user1', mockUserService));

      // Verify error was logged
      assert.ok(loggedMessage.includes('Error cleaning up user user1'));
      // Verify service.remove was called despite error
      assert.ok(removeCalled);
      // Verify object was untracked even though cleanup failed
      assert.strictEqual(context.getTracked('users').length, 0);

      // Restore console.error
      console.error = originalConsoleError;
    });

    it('should handle cleanup errors with non-Error objects', async () => {
      const mockUserService = mockServices.users;
      let removeCalled = false;
      mockUserService.remove = async (id: string) => {
        removeCalled = true;
        throw 'String error';
      };

      let loggedMessage = '';
      const originalConsoleError = console.error;
      console.error = (message: string, error?: any) => {
        loggedMessage = message;
      };

      const user = { id: 'user1', type: 'user', data: { email: 'test@example.com' } };
      context.track('users', user);

      await assert.doesNotReject(cleanupManager.cleanupObject('users', 'user1', mockUserService));

      assert.ok(loggedMessage.includes('Error cleaning up user user1'));
      assert.ok(removeCalled);
      assert.strictEqual(context.getTracked('users').length, 0);

      console.error = originalConsoleError;
    });
  });

  describe('cleanupTracked', () => {
    it('should cleanup all tracked objects of a specific type', async () => {
      const mockUserService = mockServices.users;
      const removeCalls: string[] = [];
      mockUserService.remove = async (id: string) => {
        removeCalls.push(id);
      };

      // Track multiple users
      const user1 = { id: 'user1', type: 'user', data: { email: 'test1@example.com' } };
      const user2 = { id: 'user2', type: 'user', data: { email: 'test2@example.com' } };
      const user3 = { id: 'user3', type: 'user', data: { email: 'test3@example.com' } };

      context.trackMany('users', [user1, user2, user3]);

      // Cleanup all users
      await cleanupManager.cleanupTracked('users', mockUserService);

      // Verify all objects were cleaned up in reverse order
      assert.strictEqual(removeCalls.length, 3);
      assert.deepStrictEqual(removeCalls, ['user3', 'user2', 'user1']);

      // Verify type was cleared
      assert.strictEqual(context.getTracked('users').length, 0);
    });

    it('should cleanup in reverse order for foreign key constraints', async () => {
      const mockParticipantService = mockServices.participants;
      const removeCalls: string[] = [];
      mockParticipantService.remove = async (id: string) => {
        removeCalls.push(id);
      };

      // Track participants (should be cleaned up in reverse order)
      const p1 = { id: 'p1', type: 'participant', data: {} };
      const p2 = { id: 'p2', type: 'participant', data: {} };
      const p3 = { id: 'p3', type: 'participant', data: {} };

      context.trackMany('participants', [p1, p2, p3]);

      await cleanupManager.cleanupTracked('participants', mockParticipantService);

      // Should be called in reverse order: p3, p2, p1
      assert.strictEqual(removeCalls.length, 3);
      assert.deepStrictEqual(removeCalls, ['p3', 'p2', 'p1']);
    });

    it('should handle cleanup errors in cleanupTracked without stopping', async () => {
      const mockUserService = mockServices.users;
      const removeCalls: string[] = [];
      let shouldThrow = false;
      mockUserService.remove = async (id: string) => {
        removeCalls.push(id);
        if (removeCalls.length === 2) {
          throw new Error('user2 fails');
        }
      };

      let loggedMessage = '';
      const originalConsoleError = console.error;
      console.error = (message: string, error?: Error) => {
        loggedMessage = message;
      };

      // Track users
      const users = [
        { id: 'user1', type: 'user', data: {} },
        { id: 'user2', type: 'user', data: {} },
        { id: 'user3', type: 'user', data: {} },
      ];
      context.trackMany('users', users);

      // Should not throw even when some cleanups fail
      await assert.doesNotReject(cleanupManager.cleanupTracked('users', mockUserService));

      // Verify all cleanup attempts were made
      assert.strictEqual(removeCalls.length, 3);
      // Verify error was logged
      assert.ok(loggedMessage.includes('Error cleaning up user user2'));
      // Verify type was cleared despite errors
      assert.strictEqual(context.getTracked('users').length, 0);

      console.error = originalConsoleError;
    });

    it('should handle empty tracked objects array', async () => {
      const mockUserService = mockServices.users;
      let removeCallCount = 0;
      mockUserService.remove = async (id: string) => {
        removeCallCount++;
      };

      await cleanupManager.cleanupTracked('users', mockUserService);

      // Service should not be called
      assert.strictEqual(removeCallCount, 0);
      // Type should remain empty
      assert.strictEqual(context.getTracked('users').length, 0);
    });

    it('should handle cleanupTracked with non-existent type', async () => {
      const mockUserService = mockServices.users;
      let removeCallCount = 0;
      mockUserService.remove = async (id: string) => {
        removeCallCount++;
      };

      await cleanupManager.cleanupTracked('nonexistent', mockUserService);

      // Service should not be called
      assert.strictEqual(removeCallCount, 0);
    });
  });

  describe('cleanupAll', () => {
    it('should cleanup all tracked objects in correct dependency order', async () => {
      // Setup mocks for all services
      const participantCalls: string[] = [];
      const sessionCalls: string[] = [];
      const userCalls: string[] = [];

      mockServices.participants.remove = async (id: string) => {
        participantCalls.push(id);
      };
      mockServices.sessions.remove = async (id: string) => {
        sessionCalls.push(id);
      };
      mockServices.users.remove = async (id: string) => {
        userCalls.push(id);
      };

      // Track objects in different types
      const user = { id: 'user1', type: 'user', data: {} };
      const session = { id: 'session1', type: 'session', data: {} };
      const participant = { id: 'participant1', type: 'participant', data: {} };

      context.track('users', user);
      context.track('sessions', session);
      context.track('participants', participant);

      // Cleanup all
      await cleanupManager.cleanupAll(mockServices);

      // Verify cleanup order: participants -> sessions -> users
      assert.deepStrictEqual(participantCalls, ['participant1']);
      assert.deepStrictEqual(sessionCalls, ['session1']);
      assert.deepStrictEqual(userCalls, ['user1']);
    });

    it('should handle missing services gracefully', async () => {
      const partialServices = {
        users: mockServices.users,
        // sessions and participants services are missing
      };

      let removeCallCount = 0;
      mockServices.users.remove = async (id: string) => {
        removeCallCount++;
      };

      const user = { id: 'user1', type: 'user', data: {} };
      context.track('users', user);

      // Should not throw when services are missing
      await assert.doesNotReject(cleanupManager.cleanupAll(partialServices));

      // Only available service should be called
      assert.strictEqual(removeCallCount, 1);
    });

    it('should handle cleanup errors during cleanupAll', async () => {
      let participantsThrow = false;
      mockServices.participants.remove = async (id: string) => {
        if (participantsThrow) {
          throw new Error('Participants cleanup failed');
        }
      };
      mockServices.sessions.remove = async (id: string) => {};
      mockServices.users.remove = async (id: string) => {};

      let loggedMessage = '';
      const originalConsoleError = console.error;
      console.error = (message: string, error?: Error) => {
        loggedMessage = message;
      };

      // Track objects
      const participant = { id: 'p1', type: 'participant', data: {} };
      const session = { id: 's1', type: 'session', data: {} };
      const user = { id: 'u1', type: 'user', data: {} };

      context.track('participants', participant);
      context.track('sessions', session);
      context.track('users', user);

      participantsThrow = true;

      // Should continue with other types even when one fails
      await assert.doesNotReject(cleanupManager.cleanupAll(mockServices));

      // Error should be logged
      assert.ok(loggedMessage.includes('Error during cleanup of participants'));

      console.error = originalConsoleError;
    });

    it('should handle empty tracked objects', async () => {
      // No objects tracked
      await cleanupManager.cleanupAll(mockServices);

      // No services should be called
      let usersCallCount = 0;
      let sessionsCallCount = 0;
      let participantsCallCount = 0;
      mockServices.users.remove = async (id: string) => {
        usersCallCount++;
      };
      mockServices.sessions.remove = async (id: string) => {
        sessionsCallCount++;
      };
      mockServices.participants.remove = async (id: string) => {
        participantsCallCount++;
      };

      await cleanupManager.cleanupAll(mockServices);

      assert.strictEqual(usersCallCount, 0);
      assert.strictEqual(sessionsCallCount, 0);
      assert.strictEqual(participantsCallCount, 0);
    });

    it('should handle null/undefined services object', async () => {
      const user = { id: 'user1', type: 'user', data: {} };
      context.track('users', user);

      // Should not throw with null/undefined services
      await assert.doesNotReject(cleanupManager.cleanupAll(null as any));
      await assert.doesNotReject(cleanupManager.cleanupAll(undefined as any));

      // No services should be called
    });

    it('should respect cleanup order for dependency management', async () => {
      // Track objects in reverse dependency order
      const users = [
        { id: 'user1', type: 'user', data: {} },
        { id: 'user2', type: 'user', data: {} },
      ];
      const sessions = [
        { id: 'session1', type: 'session', data: {} },
        { id: 'session2', type: 'session', data: {} },
      ];
      const participants = [
        { id: 'participant1', type: 'participant', data: {} },
        { id: 'participant2', type: 'participant', data: {} },
        { id: 'participant3', type: 'participant', data: {} },
      ];

      context.trackMany('users', users);
      context.trackMany('sessions', sessions);
      context.trackMany('participants', participants);

      // Setup mocks
      const participantCalls: string[] = [];
      const sessionCalls: string[] = [];
      const userCalls: string[] = [];

      mockServices.participants.remove = async (id: string) => {
        participantCalls.push(id);
      };
      mockServices.sessions.remove = async (id: string) => {
        sessionCalls.push(id);
      };
      mockServices.users.remove = async (id: string) => {
        userCalls.push(id);
      };

      await cleanupManager.cleanupAll(mockServices);

      // Verify participants are cleaned up first (reverse order within type)
      assert.deepStrictEqual(participantCalls, ['participant3', 'participant2', 'participant1']);

      // Then sessions
      assert.deepStrictEqual(sessionCalls, ['session2', 'session1']);

      // Finally users
      assert.deepStrictEqual(userCalls, ['user2', 'user1']);
    });
  });

  describe('integration with EnhancedTestContext', () => {
    let enhancedContext: EnhancedTestContext;

    beforeEach(() => {
      enhancedContext = new EnhancedTestContext();
    });

    afterEach(() => {
      enhancedContext.clearAllTracked();
    });

    it('should work with EnhancedTestContext delegation methods', async () => {
      const mockUserService = mockServices.users;
      let removeCalledWith = '';
      mockUserService.remove = async (id: string) => {
        removeCalledWith = id;
      };

      const user = { id: 'user1', type: 'user', data: { email: 'test@example.com' } };
      enhancedContext.track('users', user);

      // Use delegation method from EnhancedTestContext
      await enhancedContext.cleanupObject('users', 'user1', mockUserService);

      assert.strictEqual(removeCalledWith, 'user1');
      assert.strictEqual(enhancedContext.getTracked('users').length, 0);
    });

    it('should cleanup all through EnhancedTestContext', async () => {
      const participantCalls: string[] = [];
      const sessionCalls: string[] = [];
      const userCalls: string[] = [];

      mockServices.participants.remove = async (id: string) => {
        participantCalls.push(id);
      };
      mockServices.sessions.remove = async (id: string) => {
        sessionCalls.push(id);
      };
      mockServices.users.remove = async (id: string) => {
        userCalls.push(id);
      };

      // Track objects using EnhancedTestContext
      const user = { id: 'user1', type: 'user', data: {} };
      const session = { id: 'session1', type: 'session', data: {} };
      const participant = { id: 'participant1', type: 'participant', data: {} };

      enhancedContext.track('users', user);
      enhancedContext.track('sessions', session);
      enhancedContext.track('participants', participant);

      // Use delegation method
      await enhancedContext.cleanupAll(mockServices);

      // Verify all services were called in correct order
      assert.deepStrictEqual(participantCalls, ['participant1']);
      assert.deepStrictEqual(sessionCalls, ['session1']);
      assert.deepStrictEqual(userCalls, ['user1']);
    });

    it('should handle teardown integration with server management', async () => {
      const mockUserService = mockServices.users;
      let removeCalledWith = '';
      mockUserService.remove = async (id: string) => {
        removeCalledWith = id;
      };

      // Mock server manager methods
      let stopServerCalled = false;
      let getPortCallCount = 0;
      const mockStopServer = async () => {
        stopServerCalled = true;
      };
      const mockGetPort = () => {
        getPortCallCount++;
        return 3000;
      };

      // Replace server manager in enhanced context for testing
      (enhancedContext as any).serverManager = {
        stopServer: mockStopServer,
        getPort: mockGetPort,
      };

      const user = { id: 'user1', type: 'user', data: {} };
      enhancedContext.track('users', user);

      // Use teardown method
      await enhancedContext.teardown(mockServices);

      // Verify server was stopped and cleanup was performed
      assert.ok(stopServerCalled);
      assert.strictEqual(removeCalledWith, 'user1');
    });
  });

  describe('resource management and memory leak prevention', () => {
    it('should properly clean up all references', async () => {
      const mockUserService = mockServices.users;
      let removeCallCount = 0;
      mockUserService.remove = async (id: string) => {
        removeCallCount++;
      };

      // Track many objects
      const users = Array.from({ length: 100 }, (_, i) => ({
        id: `user${i}`,
        type: 'user',
        data: { email: `user${i}@example.com` },
      }));

      context.trackMany('users', users);

      // Verify objects are tracked
      assert.strictEqual(context.getTracked('users').length, 100);

      // Cleanup all
      await cleanupManager.cleanupAll({ users: mockUserService });

      // Verify all references are cleaned up
      assert.strictEqual(removeCallCount, 100);
      assert.strictEqual(context.getTracked('users').length, 0);
      assert.strictEqual(context.getAllTracked().users.length, 0);
    });

    it('should handle concurrent cleanup operations safely', async () => {
      const mockUserService = mockServices.users;
      let removeCallCount = 0;
      mockUserService.remove = async (id: string) => {
        removeCallCount++;
      };

      const user1 = { id: 'user1', type: 'user', data: {} };
      const user2 = { id: 'user2', type: 'user', data: {} };
      const user3 = { id: 'user3', type: 'user', data: {} };

      context.trackMany('users', [user1, user2, user3]);

      // Run multiple cleanup operations concurrently
      const cleanupPromises = [
        cleanupManager.cleanupObject('users', 'user1', mockUserService),
        cleanupManager.cleanupObject('users', 'user2', mockUserService),
        cleanupManager.cleanupTracked('users', mockUserService),
      ];

      // Should not throw or cause race conditions
      await assert.doesNotReject(Promise.all(cleanupPromises));

      // All operations should complete successfully (2 individual + 3 from cleanupTracked = 5, but cleanupTracked will clear the array)
      assert.strictEqual(removeCallCount, 5);
    });

    it('should handle cleanup of objects with complex data structures', async () => {
      const mockUserService = mockServices.users;
      let removeCalledWith = '';
      mockUserService.remove = async (id: string) => {
        removeCalledWith = id;
      };

      // Track objects with complex nested data
      const complexUser = {
        id: 'complex-user',
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
          },
        },
      };

      context.track('users', complexUser);

      // Should cleanup successfully despite complex data
      await assert.doesNotReject(cleanupManager.cleanupObject('users', 'complex-user', mockUserService));

      assert.strictEqual(removeCalledWith, 'complex-user');
      assert.strictEqual(context.getTracked('users').length, 0);
    });
  });

  describe('edge cases and error conditions', () => {
    it('should handle cleanup of already cleaned up objects', async () => {
      const mockUserService = mockServices.users;
      let removeCallCount = 0;
      mockUserService.remove = async (id: string) => {
        removeCallCount++;
      };

      const user = { id: 'user1', type: 'user', data: {} };
      context.track('users', user);

      // Cleanup same object multiple times
      await cleanupManager.cleanupObject('users', 'user1', mockUserService);
      await cleanupManager.cleanupObject('users', 'user1', mockUserService);

      // Should not cause errors
      assert.strictEqual(removeCallCount, 2);
      // Object should remain untracked
      assert.strictEqual(context.getTracked('users').length, 0);
    });

    it('should handle service methods that throw synchronously', async () => {
      const mockUserService = mockServices.users;
      let removeCalled = false;
      mockUserService.remove = () => {
        removeCalled = true;
        throw new Error('Sync error');
      };

      let loggedMessage = '';
      const originalConsoleError = console.error;
      console.error = (message: string, error?: Error) => {
        loggedMessage = message;
      };

      const user = { id: 'user1', type: 'user', data: {} };
      context.track('users', user);

      // Should not throw even with synchronous errors
      await assert.doesNotReject(cleanupManager.cleanupObject('users', 'user1', mockUserService));

      assert.ok(loggedMessage.includes('Error cleaning up user user1'));
      assert.ok(removeCalled);
      assert.strictEqual(context.getTracked('users').length, 0);

      console.error = originalConsoleError;
    });

    it('should handle circular dependencies gracefully', async () => {
      // Create a scenario where cleanup order matters for circular dependencies
      let removeCallCount = 0;
      const removeCalls: string[] = [];
      const mockCustomService = {
        remove: async (id: string) => {
          removeCallCount++;
          removeCalls.push(id);
        },
      };

      // Track objects that might have circular dependencies
      const obj1 = { id: 'obj1', type: 'custom', data: { dependsOn: 'obj2' } };
      const obj2 = { id: 'obj2', type: 'custom', data: { dependsOn: 'obj1' } };

      context.trackMany('custom', [obj1, obj2]);

      // Should cleanup in reverse order to break potential circular dependencies
      await cleanupManager.cleanupTracked('custom', mockCustomService);

      // Both objects should be cleaned up
      assert.strictEqual(removeCallCount, 2);
      assert.deepStrictEqual(removeCalls, ['obj2', 'obj1']);
    });
  });
});
