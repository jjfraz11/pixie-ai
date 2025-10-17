import { describe, it, beforeEach, afterEach } from 'mocha';
import assert from 'assert';
import {
  EnhancedTestContext,
  enhancedTestContext,
  createTestUser,
  createTestSession,
  createTestParticipant,
} from '../index';

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

describe('Service Helpers', () => {
  let context: EnhancedTestContext;

  beforeEach(() => {
    context = enhancedTestContext;
  });

  afterEach(() => {
    context.clearAllTracked();
  });

  describe('createTestUser', () => {
    it('should create a new user when none exists', async () => {
      // Mock service to return no existing users
      const userService = {
        ...mockUserService,
        find: async () => ({ data: [] }),
      };

      const user = await createTestUser(
        userService as any,
        'test@example.com',
        'password123',
        { roles: ['USER'] },
        false,
      );

      assert.ok(user);
      assert.ok(user.id);
      assert.strictEqual(user.email, 'test@example.com');
      const trackedUsers = context.getTracked('users');
      assert.ok(trackedUsers.length > 0, 'Should have tracked users');
      assert.ok(
        trackedUsers.some((trackedUser) => trackedUser.id === user.id),
        'Should have tracked the created user',
      );
    });

    it('should reuse existing user when found', async () => {
      const existingUser = { id: 'existing-1', email: 'test@example.com' };
      const userService = {
        ...mockUserService,
        find: async () => ({ data: [existingUser] }),
      };

      const user = await createTestUser(userService as any, 'test@example.com', 'password123');

      assert.strictEqual(user.id, 'existing-1');
      assert.strictEqual(user.email, 'test@example.com');
      const trackedUsers = context.getTracked('users');
      assert.ok(trackedUsers.length > 0, 'Should have tracked users');
      assert.ok(
        trackedUsers.some((trackedUser) => trackedUser.id === user.id),
        'Should have tracked the reused user',
      );
    });

    it('should make email unique when makeUnique is true', async () => {
      const userService = {
        ...mockUserService,
        find: async () => ({ data: [] }),
        create: async (data: any) => {
          assert.ok(data.email.includes(String(Date.now())));
          return { id: 'user-1', ...data };
        },
      };

      await createTestUser(userService as any, 'test@example.com', 'password123', {}, true);
    });

    it('should use provided email when makeUnique is false', async () => {
      const userService = {
        ...mockUserService,
        find: async () => ({ data: [] }),
        create: async (data: any) => {
          assert.strictEqual(data.email, 'test@example.com');
          return { id: 'user-1', ...data };
        },
      };

      await createTestUser(userService as any, 'test@example.com', 'password123', {}, false);
    });

    it('should use default password when none provided', async () => {
      const userService = {
        ...mockUserService,
        find: async () => ({ data: [] }),
        create: async (data: any) => {
          assert.strictEqual(data.password, 'TestPassword123!@#');
          return { id: 'user-1', ...data };
        },
      };

      await createTestUser(userService as any, 'test@example.com');
    });

    it('should uppercase roles', async () => {
      const userService = {
        ...mockUserService,
        find: async () => ({ data: [] }),
        create: async (data: any) => {
          assert.deepStrictEqual(data.roles, ['ADMIN', 'USER']);
          return { id: 'user-1', ...data };
        },
      };

      await createTestUser(userService as any, 'test@example.com', 'password123', { roles: ['admin', 'user'] }, false);
    });

    it('should use default USER role when no roles provided', async () => {
      const userService = {
        ...mockUserService,
        find: async () => ({ data: [] }),
        create: async (data: any) => {
          assert.deepStrictEqual(data.roles, ['USER']);
          return { id: 'user-1', ...data };
        },
      };

      await createTestUser(userService as any, 'test@example.com');
    });

    it('should handle find operation errors gracefully', async () => {
      const userService = {
        ...mockUserService,
        find: async () => {
          throw new Error('Database error');
        },
      };

      // Should not throw, should create new user
      const user = await createTestUser(userService as any, 'test@example.com');
      assert.ok(user);
    });
  });

  describe('createTestSession', () => {
    it('should create a session with provided host', async () => {
      const host = { id: 'host-1', type: 'user', data: {} };
      const sessionService = {
        ...mockSessionService,
        create: async (data: any, params?: any) => {
          assert.strictEqual(data.hostId, 'host-1');
          assert.strictEqual(data.title, 'Test Session BROADCAST');
          assert.strictEqual(data.type, 'BROADCAST');
          return { id: 'session-1', ...data };
        },
      };

      const session = await createTestSession(sessionService as any, 'BROADCAST', host);

      assert.ok(session);
      assert.ok(session.id);
      assert.ok(context.getTracked('sessions').includes(session));
    });

    it('should include additional data', async () => {
      const host = { id: 'host-1', type: 'user', data: {} };
      const additionalData = { description: 'Custom description' };
      const sessionService = {
        ...mockSessionService,
        create: async (data: any, params?: any) => {
          assert.strictEqual(data.description, 'Custom description');
          return { id: 'session-1', ...data };
        },
      };

      await createTestSession(sessionService as any, 'P2P', host, additionalData);
    });

    it('should pass user context to session creation', async () => {
      const host = { id: 'host-1', type: 'user', data: {} };
      const sessionService = {
        ...mockSessionService,
        create: async (data: any, params?: any) => {
          assert.ok(params);
          assert.strictEqual(params.user.id, 'host-1');
          assert.ok(params.user.roles.includes('BROADCASTER'));
          return { id: 'session-1', ...data };
        },
      };

      await createTestSession(sessionService as any, 'BROADCAST', host);
    });
  });

  describe('createTestParticipant', () => {
    it('should create a participant with session and user IDs', async () => {
      const participantService = {
        ...mockParticipantService,
        create: async (data: any) => {
          assert.strictEqual(data.sessionId, 'session-1');
          assert.strictEqual(data.userId, 'user-1');
          return { id: 'participant-1', ...data };
        },
      };

      const participant = await createTestParticipant(participantService as any, 'session-1', 'user-1');

      assert.ok(participant);
      assert.ok(participant.id);
      assert.ok(context.getTracked('participants').includes(participant));
    });

    it('should include additional data', async () => {
      const participantService = {
        ...mockParticipantService,
        create: async (data: any) => {
          assert.strictEqual(data.role, 'MODERATOR');
          return { id: 'participant-1', ...data };
        },
      };

      await createTestParticipant(participantService as any, 'session-1', 'user-1', { role: 'MODERATOR' });
    });
  });

  describe('TestContext cleanup methods', () => {
    it('should cleanup specific object', async () => {
      const user = { id: 'user-1', type: 'user', data: {} };
      context.track('users', user);

      let removeCalled = false;
      const userService = {
        remove: async (id: string) => {
          removeCalled = true;
          assert.strictEqual(id, 'user-1');
          return { id };
        },
      };

      await context.cleanupObject('users', 'user-1', userService);

      assert.ok(removeCalled);
      assert.strictEqual(context.getTracked('users').length, 0);
    });

    it('should handle cleanup errors gracefully', async () => {
      const user = { id: 'user-1', type: 'user', data: {} };
      context.track('users', user);

      const userService = {
        remove: async (id: string) => {
          throw new Error('Remove failed');
        },
      };

      // Should not throw, should just log error
      await context.cleanupObject('users', 'user-1', userService);

      // Object should still be untracked even if cleanup failed (it gets untracked in the method)
      assert.strictEqual(context.getTracked('users').length, 0);
    });

    it('should skip cleanup when service or id is missing', async () => {
      const user = { id: 'user-1', type: 'user', data: {} };
      context.track('users', user);

      await context.cleanupObject('users', '', null as any);

      // Object should remain tracked if cleanup was skipped
      assert.strictEqual(context.getTracked('users').length, 1);
    });

    it('should cleanup tracked objects in reverse order', async () => {
      const user1 = { id: 'user-1', type: 'user', data: {} };
      const user2 = { id: 'user-2', type: 'user', data: {} };
      context.trackMany('users', [user1, user2]);

      const removedIds: string[] = [];
      const userService = {
        remove: async (id: string) => {
          removedIds.push(id);
          return { id };
        },
      };

      await context.cleanupTracked('users', userService);

      // Should be removed in reverse order (user2 first, then user1)
      assert.deepStrictEqual(removedIds, ['user-2', 'user-1']);
      assert.strictEqual(context.getTracked('users').length, 0);
    });

    it('should cleanup all in correct order', async () => {
      const participant = { id: 'participant-1', type: 'participant', data: {} };
      const session = { id: 'session-1', type: 'session', data: {} };
      const user = { id: 'user-1', type: 'user', data: {} };

      context.trackMany('participants', [participant]);
      context.trackMany('sessions', [session]);
      context.trackMany('users', [user]);

      const cleanupOrder: string[] = [];
      const services = {
        participants: {
          remove: async (id: string) => {
            cleanupOrder.push('participants');
            return { id };
          },
        },
        sessions: {
          remove: async (id: string) => {
            cleanupOrder.push('sessions');
            return { id };
          },
        },
        users: {
          remove: async (id: string) => {
            cleanupOrder.push('users');
            return { id };
          },
        },
      };

      await context.cleanupAll(services);

      // Should cleanup in reverse dependency order: participants, sessions, users
      assert.deepStrictEqual(cleanupOrder, ['participants', 'sessions', 'users']);
    });

    it('should handle missing services gracefully', async () => {
      const user = { id: 'user-1', type: 'user', data: {} };
      context.track('users', user);

      // Should not throw when services are missing
      await context.cleanupAll({});
    });
  });
});
