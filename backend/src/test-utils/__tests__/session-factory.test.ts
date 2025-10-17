import { describe, it, beforeEach, afterEach } from 'mocha';
import assert from 'assert';
import { TestContext, testContext } from '../core/context';
import { CacheManager } from '../memoization/cache-manager';
import { SessionFactory } from '../factories/session-factory';
import { SessionType } from '@prisma/client';

describe('SessionFactory', () => {
  let context: TestContext;
  let cacheManager: CacheManager;
  let sessionFactory: SessionFactory;
  let mockSessionService: any;
  let mockUser: any;

  beforeEach(() => {
    context = new TestContext();
    cacheManager = new CacheManager();
    sessionFactory = new SessionFactory(context, cacheManager);

    // Create mock user object
    mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      roles: ['USER', 'BROADCASTER'],
    };

    // Create mock session service
    mockSessionService = {
      create: async (sessionData: any, options?: any) => {
        return {
          id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: sessionData.title,
          description: sessionData.description,
          type: sessionData.type,
          hostId: sessionData.hostId,
          ...sessionData,
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

  describe('createTestSession', () => {
    it('should create a P2P session successfully', async () => {
      const type = SessionType.P2P;
      const title = 'Test P2P Session';
      const description = 'A test P2P session';

      const session = await sessionFactory.createTestSession(mockSessionService, type, mockUser, {
        title,
        description,
      });

      // Verify session was created with correct data
      assert.ok(session.id);
      assert.strictEqual(session.title, title);
      assert.strictEqual(session.description, description);
      assert.strictEqual(session.type, type);
      assert.strictEqual(session.hostId, mockUser.id);

      // Verify session is tracked
      assert.strictEqual(context.getTracked('sessions').length, 1);
      assert.strictEqual(context.getTracked('sessions')[0].id, session.id);
    });

    it('should create a broadcast session successfully', async () => {
      const type = SessionType.BROADCAST;
      const title = 'Test Broadcast Session';
      const description = 'A test broadcast session';

      const session = await sessionFactory.createTestSession(mockSessionService, type, mockUser, {
        title,
        description,
      });

      // Verify session was created with correct data
      assert.ok(session.id);
      assert.strictEqual(session.title, title);
      assert.strictEqual(session.description, description);
      assert.strictEqual(session.type, type);
      assert.strictEqual(session.hostId, mockUser.id);
    });

    it('should use default title and description when not provided', async () => {
      const type = SessionType.P2P;

      const session = await sessionFactory.createTestSession(mockSessionService, type, mockUser);

      // Verify default values
      assert.strictEqual(session.title, `Test Session ${type}`);
      assert.strictEqual(session.description, `A test ${type} session`);
      assert.strictEqual(session.type, type);
      assert.strictEqual(session.hostId, mockUser.id);
    });

    it('should create session with additional custom data', async () => {
      const type = SessionType.BROADCAST;
      const additionalData = {
        title: 'Custom Session',
        description: 'Custom Description',
        maxParticipants: 100,
        isPublic: true,
        tags: ['gaming', 'entertainment'],
      };

      const session = await sessionFactory.createTestSession(mockSessionService, type, mockUser, additionalData);

      // Verify custom data is included
      assert.strictEqual(session.title, 'Custom Session');
      assert.strictEqual(session.description, 'Custom Description');
      assert.strictEqual(session.maxParticipants, 100);
      assert.strictEqual(session.isPublic, true);
      assert.deepStrictEqual(session.tags, ['gaming', 'entertainment']);
      assert.strictEqual(session.type, type);
      assert.strictEqual(session.hostId, mockUser.id);
    });

    it('should handle service creation with user context', async () => {
      const type = SessionType.P2P;
      const title = 'Test Session';

      let capturedOptions: any;
      mockSessionService.create = async (sessionData: any, options?: any) => {
        capturedOptions = options;
        return {
          id: 'session-123',
          ...sessionData,
        };
      };

      await sessionFactory.createTestSession(mockSessionService, type, mockUser, { title });

      // Verify user context was passed to service
      assert.ok(capturedOptions);
      assert.ok(capturedOptions.user);
      assert.strictEqual(capturedOptions.user.id, mockUser.id);
      assert.deepStrictEqual(capturedOptions.user.roles, mockUser.roles);
    });
  });

  describe('cache functionality', () => {
    it('should cache created sessions and return cached version on subsequent calls', async () => {
      const type = SessionType.P2P;
      const title = 'Test Session';
      const description = 'Test Description';

      // Mock service to track creation calls
      let createCallCount = 0;
      mockSessionService.create = async (sessionData: any, options?: any) => {
        createCallCount++;
        return {
          id: `session-${createCallCount}`,
          ...sessionData,
        };
      };

      // Create first session
      const session1 = await sessionFactory.createTestSession(mockSessionService, type, mockUser, {
        title,
        description,
      });

      // Create second session with same parameters
      const session2 = await sessionFactory.createTestSession(mockSessionService, type, mockUser, {
        title,
        description,
      });

      // Should return cached session (same object reference)
      assert.strictEqual(session1, session2);
      assert.strictEqual(createCallCount, 1);

      // Verify cache stats
      const stats = cacheManager.getCacheStats();
      assert.strictEqual(stats.hits, 1);
      assert.strictEqual(stats.misses, 1);
      assert.strictEqual(stats.sets, 1);
    });

    it('should handle database fallback when session exists', async () => {
      const type = SessionType.BROADCAST;
      const title = 'Existing Session';
      const existingSession = {
        id: 'existing-session-id',
        title,
        description: 'Existing session',
        type,
        hostId: mockUser.id,
      };

      // Mock service to return existing session
      mockSessionService.find = async (query: any) => {
        if (query.query.title === title && query.query.hostId === mockUser.id) {
          return { data: [existingSession] };
        }
        return { data: [] };
      };

      let createCallCount = 0;
      mockSessionService.create = async (sessionData: any, options?: any) => {
        createCallCount++;
        return { id: 'new-session-id', ...sessionData };
      };

      const session = await sessionFactory.createTestSession(mockSessionService, type, mockUser, {
        title,
        description: 'Existing session',
      });

      // Should return existing session, not create new one
      assert.strictEqual(session.id, 'existing-session-id');
      assert.strictEqual(createCallCount, 0);

      // Should be cached
      const cachedSession = cacheManager.getCached('sessions', {
        title,
        description: 'Existing session',
        type,
        hostId: mockUser.id,
      });
      assert.ok(cachedSession);
    });

    it('should handle database errors gracefully', async () => {
      const type = SessionType.P2P;
      const title = 'Test Session';

      // Mock service to throw error on find
      mockSessionService.find = async (query: any) => {
        throw new Error('Database connection failed');
      };

      // Mock console.warn to capture warning
      let warnedMessage = '';
      const originalConsoleWarn = console.warn;
      console.warn = (message: string, error?: Error) => {
        warnedMessage = message;
      };

      let createCallCount = 0;
      mockSessionService.create = async (sessionData: any, options?: any) => {
        createCallCount++;
        return { id: 'session-1', ...sessionData };
      };

      const session = await sessionFactory.createTestSession(mockSessionService, type, mockUser, {
        title,
      });

      // Should still create session despite database error
      assert.ok(session.id);
      assert.ok(warnedMessage.includes('Could not check for existing session'));
      assert.strictEqual(createCallCount, 1);

      console.warn = originalConsoleWarn;
    });
  });

  describe('createTestSessions', () => {
    it('should create multiple sessions successfully', async () => {
      const sessionConfigs = [
        { type: SessionType.P2P, host: mockUser, additionalData: { title: 'P2P Session 1' } },
        { type: SessionType.BROADCAST, host: mockUser, additionalData: { title: 'Broadcast Session 1' } },
        { type: SessionType.P2P, host: mockUser, additionalData: { title: 'P2P Session 2' } },
      ];

      const sessions = await sessionFactory.createTestSessions(mockSessionService, sessionConfigs);

      assert.strictEqual(sessions.length, 3);
      sessions.forEach((session, index) => {
        assert.ok(session.id);
        assert.strictEqual(session.type, sessionConfigs[index].type);
        assert.strictEqual(session.hostId, mockUser.id);
      });

      // All sessions should be tracked
      assert.strictEqual(context.getTracked('sessions').length, 3);
    });

    it('should handle empty session configs array', async () => {
      const sessions = await sessionFactory.createTestSessions(mockSessionService, []);

      assert.deepStrictEqual(sessions, []);
      assert.strictEqual(context.getTracked('sessions').length, 0);
    });

    it('should handle mixed session configurations', async () => {
      const sessionConfigs = [
        { type: SessionType.BROADCAST, host: mockUser, additionalData: { title: 'Custom Broadcast' } },
        { type: SessionType.P2P, host: mockUser }, // Should use defaults
      ];

      const sessions = await sessionFactory.createTestSessions(mockSessionService, sessionConfigs);

      assert.strictEqual(sessions.length, 2);

      // First session should have custom title
      assert.strictEqual(sessions[0].title, 'Custom Broadcast');
      assert.strictEqual(sessions[0].type, SessionType.BROADCAST);

      // Second session should have default title
      assert.strictEqual(sessions[1].title, `Test Session ${SessionType.P2P}`);
      assert.strictEqual(sessions[1].type, SessionType.P2P);
    });
  });

  describe('createCustomSession', () => {
    it('should create session with fully custom data', async () => {
      const sessionData = {
        title: 'Fully Custom Session',
        description: 'A completely custom session',
        type: SessionType.BROADCAST,
        host: mockUser,
        additionalData: {
          maxParticipants: 50,
          isPublic: false,
          settings: {
            quality: 'HD',
            bitrate: 5000,
          },
        },
      };

      const session = await sessionFactory.createCustomSession(mockSessionService, sessionData);

      // Verify all custom data is preserved
      assert.ok(session.id);
      assert.strictEqual(session.title, 'Fully Custom Session');
      assert.strictEqual(session.description, 'A completely custom session');
      assert.strictEqual(session.type, SessionType.BROADCAST);
      assert.strictEqual(session.hostId, mockUser.id);
      assert.strictEqual(session.maxParticipants, 50);
      assert.strictEqual(session.isPublic, false);
      assert.deepStrictEqual(session.settings, { quality: 'HD', bitrate: 5000 });
    });

    it('should handle custom session with minimal data', async () => {
      const sessionData = {
        title: 'Minimal Session',
        type: SessionType.P2P,
        host: mockUser,
      };

      const session = await sessionFactory.createCustomSession(mockSessionService, sessionData);

      // Verify required fields and defaults
      assert.ok(session.id);
      assert.strictEqual(session.title, 'Minimal Session');
      assert.strictEqual(session.description, ''); // Default empty description
      assert.strictEqual(session.type, SessionType.P2P);
      assert.strictEqual(session.hostId, mockUser.id);
    });

    it('should handle custom session with missing description', async () => {
      const sessionData = {
        title: 'Session Without Description',
        type: SessionType.BROADCAST,
        host: mockUser,
        additionalData: { maxParticipants: 10 },
      };

      const session = await sessionFactory.createCustomSession(mockSessionService, sessionData);

      // Should use empty string as default description
      assert.strictEqual(session.description, '');
      assert.strictEqual(session.maxParticipants, 10);
    });

    it('should cache custom sessions properly', async () => {
      const sessionData = {
        title: 'Cacheable Session',
        description: 'This should be cached',
        type: SessionType.P2P,
        host: mockUser,
      };

      // Mock service to track calls
      let createCallCount = 0;
      mockSessionService.create = async (data: any, options?: any) => {
        createCallCount++;
        return { id: `session-${createCallCount}`, ...data };
      };

      // Create first session
      const session1 = await sessionFactory.createCustomSession(mockSessionService, sessionData);

      // Create second session with same data
      const session2 = await sessionFactory.createCustomSession(mockSessionService, sessionData);

      // Should return cached session
      assert.strictEqual(session1, session2);
      assert.strictEqual(createCallCount, 1);
    });
  });

  describe('cache management', () => {
    it('should invalidate specific session cache', async () => {
      const type = SessionType.P2P;
      const title = 'Test Session';
      const description = 'Test Description';

      // Create session
      const session1 = await sessionFactory.createTestSession(mockSessionService, type, mockUser, {
        title,
        description,
      });

      // Use cache for second call
      const session2 = await sessionFactory.createTestSession(mockSessionService, type, mockUser, {
        title,
        description,
      });

      assert.strictEqual(session1, session2);

      // Invalidate specific cache
      sessionFactory.invalidateSessionCache({ title, description, type, hostId: mockUser.id });

      // Create another session (should create new one)
      const session3 = await sessionFactory.createTestSession(mockSessionService, type, mockUser, {
        title,
        description,
      });

      assert.notStrictEqual(session1, session3);
    });

    it('should clear all session cache', async () => {
      const type1 = SessionType.P2P;
      const type2 = SessionType.BROADCAST;

      // Create sessions with different parameters
      const session1 = await sessionFactory.createTestSession(mockSessionService, type1, mockUser, {
        title: 'Session 1',
      });
      const session2 = await sessionFactory.createTestSession(mockSessionService, type2, mockUser, {
        title: 'Session 2',
      });

      // Use cache for second calls
      const cachedSession1 = await sessionFactory.createTestSession(mockSessionService, type1, mockUser, {
        title: 'Session 1',
      });
      const cachedSession2 = await sessionFactory.createTestSession(mockSessionService, type2, mockUser, {
        title: 'Session 2',
      });

      assert.strictEqual(session1, cachedSession1);
      assert.strictEqual(session2, cachedSession2);

      // Clear all session cache
      sessionFactory.clearSessionCache();

      // Create new sessions (should create new instances)
      const newSession1 = await sessionFactory.createTestSession(mockSessionService, type1, mockUser, {
        title: 'Session 1',
      });
      const newSession2 = await sessionFactory.createTestSession(mockSessionService, type2, mockUser, {
        title: 'Session 2',
      });

      assert.notStrictEqual(session1, newSession1);
      assert.notStrictEqual(session2, newSession2);
    });

    it('should handle cache invalidation with complex properties', async () => {
      const complexData = {
        title: 'Complex Session',
        description: 'Session with complex data',
        type: SessionType.BROADCAST,
        hostId: mockUser.id,
        maxParticipants: 100,
        settings: { quality: 'HD' },
      };

      // Create session with complex properties
      const session1 = await sessionFactory.createTestSession(mockSessionService, complexData.type, mockUser, {
        title: complexData.title,
        description: complexData.description,
        maxParticipants: complexData.maxParticipants,
        settings: complexData.settings,
      });

      // Use cache
      const session2 = await sessionFactory.createTestSession(mockSessionService, complexData.type, mockUser, {
        title: complexData.title,
        description: complexData.description,
        maxParticipants: complexData.maxParticipants,
        settings: complexData.settings,
      });

      assert.strictEqual(session1, session2);

      // Invalidate with complex properties
      sessionFactory.invalidateSessionCache(complexData);

      // Should create new session
      const session3 = await sessionFactory.createTestSession(mockSessionService, complexData.type, mockUser, {
        title: complexData.title,
        description: complexData.description,
        maxParticipants: complexData.maxParticipants,
        settings: complexData.settings,
      });

      assert.notStrictEqual(session1, session3);
    });
  });

  describe('error handling', () => {
    it('should handle service creation errors gracefully', async () => {
      const type = SessionType.P2P;
      const title = 'Test Session';

      // Mock service to throw error on create
      mockSessionService.create = async (data: any, options?: any) => {
        throw new Error('Session creation failed');
      };

      // Mock console.error to capture error logs
      let errorMessage = '';
      const originalConsoleError = console.error;
      console.error = (message: string, error?: Error) => {
        errorMessage = message;
      };

      try {
        await sessionFactory.createTestSession(mockSessionService, type, mockUser, { title });
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.message, 'Session creation failed');
      }

      console.error = originalConsoleError;
    });

    it('should handle malformed session data', async () => {
      const type = SessionType.P2P;
      const title = 'Test Session';

      // Mock service to return malformed data
      mockSessionService.create = async (data: any, options?: any) => {
        return {
          // Missing required fields
          title: null,
          type: undefined,
          hostId: null,
        };
      };

      const session = await sessionFactory.createTestSession(mockSessionService, type, mockUser, {
        title,
      });

      // Should handle malformed data gracefully
      assert.ok(session);
      assert.strictEqual(session.title, null);
      assert.strictEqual(session.type, undefined);
      assert.strictEqual(session.hostId, null);
    });

    it('should handle cache manager errors', async () => {
      const type = SessionType.P2P;
      const title = 'Test Session';

      // Create session first
      const session1 = await sessionFactory.createTestSession(mockSessionService, type, mockUser, {
        title,
      });

      // Mock cache manager to throw errors
      const originalGetCached = cacheManager.getCached;
      cacheManager.getCached = () => {
        throw new Error('Cache error');
      };

      // Should handle cache errors gracefully and create new session
      const session2 = await sessionFactory.createTestSession(mockSessionService, type, mockUser, {
        title,
      });

      assert.notStrictEqual(session1, session2);

      // Restore original method
      cacheManager.getCached = originalGetCached;
    });

    it('should handle invalid session type', async () => {
      const invalidType = 'INVALID_TYPE' as SessionType;
      const title = 'Test Session';

      // Mock service should still create despite invalid type
      mockSessionService.create = async (data: any, options?: any) => {
        return {
          id: 'session-123',
          ...data,
        };
      };

      const session = await sessionFactory.createTestSession(mockSessionService, invalidType, mockUser, {
        title,
      });

      // Should handle invalid type gracefully
      assert.ok(session);
      assert.strictEqual(session.title, title);
      assert.strictEqual(session.type, invalidType);
    });
  });

  describe('integration with context tracking', () => {
    it('should properly track created sessions', async () => {
      const type = SessionType.P2P;
      const title = 'Test Session';

      const session = await sessionFactory.createTestSession(mockSessionService, type, mockUser, {
        title,
      });

      // Verify session is tracked
      const trackedSessions = context.getTracked('sessions');
      assert.strictEqual(trackedSessions.length, 1);
      assert.strictEqual(trackedSessions[0].id, session.id);
      assert.strictEqual(trackedSessions[0].type, 'session');
      assert.strictEqual(trackedSessions[0].data, session);
    });

    it('should handle context tracking errors', async () => {
      const type = SessionType.P2P;
      const title = 'Test Session';

      // Mock context to throw error on track
      const originalTrack = context.track;
      context.track = () => {
        throw new Error('Tracking error');
      };

      try {
        await sessionFactory.createTestSession(mockSessionService, type, mockUser, { title });
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.message, 'Tracking error');
      }

      // Restore original method
      context.track = originalTrack;
    });

    it('should work with isolated test contexts', async () => {
      const type = SessionType.BROADCAST;
      const title = 'Isolated Session';

      // Create isolated context
      const isolatedContext = context.createIsolatedContext();

      // Create factory with isolated context
      const isolatedFactory = new SessionFactory(isolatedContext, cacheManager);

      const session = await isolatedFactory.createTestSession(mockSessionService, type, mockUser, {
        title,
      });

      // Verify session is tracked in isolated context, not main context
      assert.strictEqual(isolatedContext.getTracked('sessions').length, 1);
      assert.strictEqual(context.getTracked('sessions').length, 0);
    });
  });

  describe('performance scenarios', () => {
    it('should handle bulk session creation efficiently', async () => {
      const sessionCount = 30;
      const sessionConfigs = Array.from({ length: sessionCount }, (_, i) => ({
        type: i % 2 === 0 ? SessionType.P2P : SessionType.BROADCAST,
        host: mockUser,
        additionalData: { title: `Session ${i}` },
      }));

      const startTime = Date.now();
      const sessions = await sessionFactory.createTestSessions(mockSessionService, sessionConfigs);
      const endTime = Date.now();

      // Should create all sessions
      assert.strictEqual(sessions.length, sessionCount);

      // Should complete within reasonable time (less than 5 seconds for 30 sessions)
      assert.ok(endTime - startTime < 5000);

      // All sessions should be tracked
      assert.strictEqual(context.getTracked('sessions').length, sessionCount);
    });

    it('should handle cache performance with many different sessions', async () => {
      const sessionCount = 15;

      // Create many different sessions
      for (let i = 0; i < sessionCount; i++) {
        await sessionFactory.createTestSession(mockSessionService, SessionType.P2P, mockUser, {
          title: `Unique Session ${i}`,
          description: `Description ${i}`,
        });
      }

      const stats = cacheManager.getCacheStats();
      assert.strictEqual(stats.sets, sessionCount);
      assert.ok(stats.size <= cacheManager.getConfig().maxSize);
    });
  });
});
