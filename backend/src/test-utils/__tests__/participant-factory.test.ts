import { describe, it, beforeEach, afterEach } from 'mocha';
import assert from 'assert';
import { TestContext, testContext } from '../core/context';
import { CacheManager } from '../memoization/cache-manager';
import { ParticipantFactory } from '../factories/participant-factory';

describe('ParticipantFactory', () => {
  let context: TestContext;
  let cacheManager: CacheManager;
  let participantFactory: ParticipantFactory;
  let mockParticipantService: any;
  let mockSessionId: string;
  let mockUserId: string;

  beforeEach(() => {
    context = new TestContext();
    cacheManager = new CacheManager();
    participantFactory = new ParticipantFactory(context, cacheManager);

    // Create mock IDs
    mockSessionId = 'session-123';
    mockUserId = 'user-456';

    // Create mock participant service
    mockParticipantService = {
      create: async (participantData: any) => {
        return {
          id: `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sessionId: participantData.sessionId,
          userId: participantData.userId,
          joinedAt: new Date().toISOString(),
          ...participantData,
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

  describe('createTestParticipant', () => {
    it('should create a participant successfully', async () => {
      const additionalData = {
        role: 'viewer',
        permissions: ['read', 'write'],
      };

      const participant = await participantFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
        additionalData,
      );

      // Verify participant was created with correct data
      assert.ok(participant.id);
      assert.strictEqual(participant.sessionId, mockSessionId);
      assert.strictEqual(participant.userId, mockUserId);
      assert.strictEqual(participant.role, 'viewer');
      assert.deepStrictEqual(participant.permissions, ['read', 'write']);
      assert.ok(participant.joinedAt);

      // Verify participant is tracked
      assert.strictEqual(context.getTracked('participants').length, 1);
      assert.strictEqual(context.getTracked('participants')[0].id, participant.id);
    });

    it('should create participant with default data when no additional data provided', async () => {
      const participant = await participantFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
      );

      // Verify participant was created with correct basic data
      assert.ok(participant.id);
      assert.strictEqual(participant.sessionId, mockSessionId);
      assert.strictEqual(participant.userId, mockUserId);
      assert.ok(participant.joinedAt);
    });

    it('should create participant with complex additional data', async () => {
      const additionalData = {
        role: 'moderator',
        permissions: ['read', 'write', 'moderate'],
        settings: {
          notifications: true,
          theme: 'dark',
          language: 'en',
        },
        metadata: {
          joinedVia: 'invitation',
          referrer: 'user-789',
        },
      };

      const participant = await participantFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
        additionalData,
      );

      // Verify complex data is preserved
      assert.strictEqual(participant.role, 'moderator');
      assert.deepStrictEqual(participant.permissions, ['read', 'write', 'moderate']);
      assert.strictEqual(participant.settings.notifications, true);
      assert.strictEqual(participant.settings.theme, 'dark');
      assert.strictEqual(participant.settings.language, 'en');
      assert.strictEqual(participant.metadata.joinedVia, 'invitation');
      assert.strictEqual(participant.metadata.referrer, 'user-789');
    });
  });

  describe('cache functionality', () => {
    it('should cache created participants and return cached version on subsequent calls', async () => {
      const additionalData = {
        role: 'viewer',
        permissions: ['read'],
      };

      // Mock service to track creation calls
      let createCallCount = 0;
      mockParticipantService.create = async (participantData: any) => {
        createCallCount++;
        return {
          id: `participant-${createCallCount}`,
          ...participantData,
          joinedAt: new Date().toISOString(),
        };
      };

      // Create first participant
      const participant1 = await participantFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
        additionalData,
      );

      // Create second participant with same parameters
      const participant2 = await participantFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
        additionalData,
      );

      // Should return cached participant (same object reference)
      assert.strictEqual(participant1, participant2);
      assert.strictEqual(createCallCount, 1);

      // Verify cache stats
      const stats = cacheManager.getCacheStats();
      assert.strictEqual(stats.hits, 1);
      assert.strictEqual(stats.misses, 1);
      assert.strictEqual(stats.sets, 1);
    });

    it('should handle database fallback when participant exists', async () => {
      const additionalData = { role: 'viewer' };
      const existingParticipant = {
        id: 'existing-participant-id',
        sessionId: mockSessionId,
        userId: mockUserId,
        role: 'viewer',
        joinedAt: new Date().toISOString(),
      };

      // Mock service to return existing participant
      mockParticipantService.find = async (query: any) => {
        if (query.query.sessionId === mockSessionId && query.query.userId === mockUserId) {
          return { data: [existingParticipant] };
        }
        return { data: [] };
      };

      let createCallCount = 0;
      mockParticipantService.create = async (participantData: any) => {
        createCallCount++;
        return { id: 'new-participant-id', ...participantData };
      };

      const participant = await participantFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
        additionalData,
      );

      // Should return existing participant, not create new one
      assert.strictEqual(participant.id, 'existing-participant-id');
      assert.strictEqual(createCallCount, 0);

      // Should be cached
      const cachedParticipant = cacheManager.getCached('participants', {
        sessionId: mockSessionId,
        userId: mockUserId,
        role: 'viewer',
      });
      assert.ok(cachedParticipant);
    });

    it('should handle database errors gracefully', async () => {
      const additionalData = { role: 'viewer' };

      // Mock service to throw error on find
      mockParticipantService.find = async (query: any) => {
        throw new Error('Database connection failed');
      };

      // Mock console.warn to capture warning
      let warnedMessage = '';
      const originalConsoleWarn = console.warn;
      console.warn = (message: string, error?: Error) => {
        warnedMessage = message;
      };

      let createCallCount = 0;
      mockParticipantService.create = async (participantData: any) => {
        createCallCount++;
        return {
          id: 'participant-1',
          ...participantData,
          joinedAt: new Date().toISOString(),
        };
      };

      const participant = await participantFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
        additionalData,
      );

      // Should still create participant despite database error
      assert.ok(participant.id);
      assert.ok(warnedMessage.includes('Could not check for existing participant'));
      assert.strictEqual(createCallCount, 1);

      console.warn = originalConsoleWarn;
    });

    it('should handle cache misses correctly for different participants', async () => {
      // Create participants with different parameters
      const participant1 = await participantFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
        { role: 'viewer' },
      );

      const participant2 = await participantFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
        { role: 'moderator' },
      );

      const participant3 = await participantFactory.createTestParticipant(
        mockParticipantService,
        'different-session',
        mockUserId,
        { role: 'viewer' },
      );

      // All should be different objects due to different cache keys
      assert.notStrictEqual(participant1, participant2);
      assert.notStrictEqual(participant1, participant3);
      assert.notStrictEqual(participant2, participant3);

      // Verify cache stats
      const stats = cacheManager.getCacheStats();
      assert.strictEqual(stats.misses, 3);
      assert.strictEqual(stats.sets, 3);
    });
  });

  describe('createTestParticipants', () => {
    it('should create multiple participants successfully', async () => {
      const participantConfigs = [
        { sessionId: mockSessionId, userId: 'user-1', additionalData: { role: 'viewer' } },
        { sessionId: mockSessionId, userId: 'user-2', additionalData: { role: 'moderator' } },
        { sessionId: mockSessionId, userId: 'user-3', additionalData: { role: 'viewer' } },
      ];

      const participants = await participantFactory.createTestParticipants(mockParticipantService, participantConfigs);

      assert.strictEqual(participants.length, 3);
      participants.forEach((participant, index) => {
        assert.ok(participant.id);
        assert.strictEqual(participant.sessionId, participantConfigs[index].sessionId);
        assert.strictEqual(participant.userId, participantConfigs[index].userId);
        assert.strictEqual(participant.role, participantConfigs[index].additionalData.role);
      });

      // All participants should be tracked
      assert.strictEqual(context.getTracked('participants').length, 3);
    });

    it('should handle empty participant configs array', async () => {
      const participants = await participantFactory.createTestParticipants(mockParticipantService, []);

      assert.deepStrictEqual(participants, []);
      assert.strictEqual(context.getTracked('participants').length, 0);
    });

    it('should handle mixed participant configurations', async () => {
      const participantConfigs = [
        {
          sessionId: mockSessionId,
          userId: 'user-1',
          additionalData: { role: 'moderator', permissions: ['read', 'write', 'moderate'] },
        },
        {
          sessionId: mockSessionId,
          userId: 'user-2',
          // Should use defaults
        },
        {
          sessionId: 'session-2',
          userId: 'user-3',
          additionalData: { role: 'viewer' },
        },
      ];

      const participants = await participantFactory.createTestParticipants(mockParticipantService, participantConfigs);

      assert.strictEqual(participants.length, 3);

      // First participant should have complex data
      assert.strictEqual(participants[0].role, 'moderator');
      assert.deepStrictEqual(participants[0].permissions, ['read', 'write', 'moderate']);

      // Second participant should have defaults (no additional data)
      assert.ok(participants[1].sessionId);
      assert.ok(participants[1].userId);

      // Third participant should have different session
      assert.strictEqual(participants[2].sessionId, 'session-2');
      assert.strictEqual(participants[2].role, 'viewer');
    });
  });

  describe('createCustomParticipant', () => {
    it('should create participant with fully custom data', async () => {
      const participantData = {
        sessionId: mockSessionId,
        userId: mockUserId,
        additionalData: {
          role: 'broadcaster',
          permissions: ['read', 'write', 'broadcast'],
          settings: {
            quality: 'HD',
            bitrate: 5000,
            muted: false,
          },
          metadata: {
            device: 'desktop',
            browser: 'Chrome',
          },
        },
      };

      const participant = await participantFactory.createCustomParticipant(mockParticipantService, participantData);

      // Verify all custom data is preserved
      assert.ok(participant.id);
      assert.strictEqual(participant.sessionId, mockSessionId);
      assert.strictEqual(participant.userId, mockUserId);
      assert.strictEqual(participant.role, 'broadcaster');
      assert.deepStrictEqual(participant.permissions, ['read', 'write', 'broadcast']);
      assert.strictEqual(participant.settings.quality, 'HD');
      assert.strictEqual(participant.settings.bitrate, 5000);
      assert.strictEqual(participant.settings.muted, false);
      assert.strictEqual(participant.metadata.device, 'desktop');
      assert.strictEqual(participant.metadata.browser, 'Chrome');
    });

    it('should handle custom participant with minimal data', async () => {
      const participantData = {
        sessionId: mockSessionId,
        userId: mockUserId,
      };

      const participant = await participantFactory.createCustomParticipant(mockParticipantService, participantData);

      // Verify required fields only
      assert.ok(participant.id);
      assert.strictEqual(participant.sessionId, mockSessionId);
      assert.strictEqual(participant.userId, mockUserId);
      assert.ok(participant.joinedAt);
    });

    it('should handle custom participant with complex nested data', async () => {
      const participantData = {
        sessionId: mockSessionId,
        userId: mockUserId,
        additionalData: {
          profile: {
            avatar: 'https://example.com/avatar.jpg',
            displayName: 'Test User',
            bio: 'Test user bio',
          },
          preferences: {
            notifications: {
              email: true,
              push: false,
              sms: true,
            },
            privacy: {
              showOnlineStatus: true,
              allowMessages: 'friends',
            },
          },
        },
      };

      const participant = await participantFactory.createCustomParticipant(mockParticipantService, participantData);

      // Verify complex nested data is preserved
      assert.strictEqual(participant.profile.avatar, 'https://example.com/avatar.jpg');
      assert.strictEqual(participant.profile.displayName, 'Test User');
      assert.strictEqual(participant.profile.bio, 'Test user bio');
      assert.strictEqual(participant.preferences.notifications.email, true);
      assert.strictEqual(participant.preferences.notifications.push, false);
      assert.strictEqual(participant.preferences.notifications.sms, true);
      assert.strictEqual(participant.preferences.privacy.showOnlineStatus, true);
      assert.strictEqual(participant.preferences.privacy.allowMessages, 'friends');
    });
  });

  describe('cache management', () => {
    it('should invalidate specific participant cache', async () => {
      const additionalData = { role: 'viewer' };

      // Create participant
      const participant1 = await participantFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
        additionalData,
      );

      // Use cache for second call
      const participant2 = await participantFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
        additionalData,
      );

      assert.strictEqual(participant1, participant2);

      // Invalidate specific cache
      participantFactory.invalidateParticipantCache({
        sessionId: mockSessionId,
        userId: mockUserId,
        role: 'viewer',
      });

      // Create another participant (should create new one)
      const participant3 = await participantFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
        additionalData,
      );

      assert.notStrictEqual(participant1, participant3);
    });

    it('should clear all participant cache', async () => {
      const sessionId1 = 'session-1';
      const sessionId2 = 'session-2';
      const userId1 = 'user-1';
      const userId2 = 'user-2';

      // Create participants with different parameters
      const participant1 = await participantFactory.createTestParticipant(mockParticipantService, sessionId1, userId1, {
        role: 'viewer',
      });
      const participant2 = await participantFactory.createTestParticipant(mockParticipantService, sessionId2, userId2, {
        role: 'moderator',
      });

      // Use cache for second calls
      const cachedParticipant1 = await participantFactory.createTestParticipant(
        mockParticipantService,
        sessionId1,
        userId1,
        { role: 'viewer' },
      );
      const cachedParticipant2 = await participantFactory.createTestParticipant(
        mockParticipantService,
        sessionId2,
        userId2,
        { role: 'moderator' },
      );

      assert.strictEqual(participant1, cachedParticipant1);
      assert.strictEqual(participant2, cachedParticipant2);

      // Clear all participant cache
      participantFactory.clearParticipantCache();

      // Create new participants (should create new instances)
      const newParticipant1 = await participantFactory.createTestParticipant(
        mockParticipantService,
        sessionId1,
        userId1,
        { role: 'viewer' },
      );
      const newParticipant2 = await participantFactory.createTestParticipant(
        mockParticipantService,
        sessionId2,
        userId2,
        { role: 'moderator' },
      );

      assert.notStrictEqual(participant1, newParticipant1);
      assert.notStrictEqual(participant2, newParticipant2);
    });

    it('should handle cache invalidation with complex properties', async () => {
      const complexData = {
        sessionId: mockSessionId,
        userId: mockUserId,
        role: 'broadcaster',
        permissions: ['read', 'write', 'broadcast'],
        settings: { quality: 'HD' },
      };

      // Create participant with complex properties
      const participant1 = await participantFactory.createTestParticipant(
        mockParticipantService,
        complexData.sessionId,
        complexData.userId,
        {
          role: complexData.role,
          permissions: complexData.permissions,
          settings: complexData.settings,
        },
      );

      // Use cache
      const participant2 = await participantFactory.createTestParticipant(
        mockParticipantService,
        complexData.sessionId,
        complexData.userId,
        {
          role: complexData.role,
          permissions: complexData.permissions,
          settings: complexData.settings,
        },
      );

      assert.strictEqual(participant1, participant2);

      // Invalidate with complex properties
      participantFactory.invalidateParticipantCache(complexData);

      // Should create new participant
      const participant3 = await participantFactory.createTestParticipant(
        mockParticipantService,
        complexData.sessionId,
        complexData.userId,
        {
          role: complexData.role,
          permissions: complexData.permissions,
          settings: complexData.settings,
        },
      );

      assert.notStrictEqual(participant1, participant3);
    });
  });

  describe('error handling', () => {
    it('should handle service creation errors gracefully', async () => {
      // Mock service to throw error on create
      mockParticipantService.create = async (participantData: any) => {
        throw new Error('Participant creation failed');
      };

      // Mock console.error to capture error logs
      let errorMessage = '';
      const originalConsoleError = console.error;
      console.error = (message: string, error?: Error) => {
        errorMessage = message;
      };

      try {
        await participantFactory.createTestParticipant(mockParticipantService, mockSessionId, mockUserId);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.message, 'Participant creation failed');
      }

      console.error = originalConsoleError;
    });

    it('should handle malformed participant data', async () => {
      // Mock service to return malformed data
      mockParticipantService.create = async (participantData: any) => {
        return {
          // Missing required fields and malformed data
          id: null,
          sessionId: undefined,
          userId: null,
          joinedAt: 'invalid-date',
        };
      };

      const participant = await participantFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
      );

      // Should handle malformed data gracefully
      assert.ok(participant);
      assert.strictEqual(participant.id, null);
      assert.strictEqual(participant.sessionId, undefined);
      assert.strictEqual(participant.userId, null);
      assert.strictEqual(participant.joinedAt, 'invalid-date');
    });

    it('should handle cache manager errors', async () => {
      // Create participant first
      const participant1 = await participantFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
        { role: 'viewer' },
      );

      // Mock cache manager to throw errors
      const originalGetCached = cacheManager.getCached;
      cacheManager.getCached = () => {
        throw new Error('Cache error');
      };

      // Should handle cache errors gracefully and create new participant
      const participant2 = await participantFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
        { role: 'viewer' },
      );

      assert.notStrictEqual(participant1, participant2);

      // Restore original method
      cacheManager.getCached = originalGetCached;
    });

    it('should handle invalid session or user IDs', async () => {
      // Test with empty/null IDs
      const testCases = [
        { sessionId: '', userId: mockUserId },
        { sessionId: mockSessionId, userId: '' },
        { sessionId: null as any, userId: mockUserId },
        { sessionId: mockSessionId, userId: undefined as any },
      ];

      for (const testCase of testCases) {
        mockParticipantService.create = async (data: any) => {
          return {
            id: 'participant-123',
            ...data,
            joinedAt: new Date().toISOString(),
          };
        };

        const participant = await participantFactory.createTestParticipant(
          mockParticipantService,
          testCase.sessionId,
          testCase.userId,
        );

        // Should handle invalid IDs gracefully
        assert.ok(participant);
        assert.ok(participant.id);
      }
    });
  });

  describe('integration with context tracking', () => {
    it('should properly track created participants', async () => {
      const participant = await participantFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
        { role: 'viewer' },
      );

      // Verify participant is tracked
      const trackedParticipants = context.getTracked('participants');
      assert.strictEqual(trackedParticipants.length, 1);
      assert.strictEqual(trackedParticipants[0].id, participant.id);
      assert.strictEqual(trackedParticipants[0].type, 'participant');
      assert.strictEqual(trackedParticipants[0].data, participant);
    });

    it('should handle context tracking errors', async () => {
      // Mock context to throw error on track
      const originalTrack = context.track;
      context.track = () => {
        throw new Error('Tracking error');
      };

      try {
        await participantFactory.createTestParticipant(mockParticipantService, mockSessionId, mockUserId);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.message, 'Tracking error');
      }

      // Restore original method
      context.track = originalTrack;
    });

    it('should work with isolated test contexts', async () => {
      // Create isolated context
      const isolatedContext = context.createIsolatedContext();

      // Create factory with isolated context
      const isolatedFactory = new ParticipantFactory(isolatedContext, cacheManager);

      const participant = await isolatedFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
        { role: 'viewer' },
      );

      // Verify participant is tracked in isolated context, not main context
      assert.strictEqual(isolatedContext.getTracked('participants').length, 1);
      assert.strictEqual(context.getTracked('participants').length, 0);
    });
  });

  describe('performance scenarios', () => {
    it('should handle bulk participant creation efficiently', async () => {
      const participantCount = 40;
      const participantConfigs = Array.from({ length: participantCount }, (_, i) => ({
        sessionId: `session-${i % 5}`, // 5 different sessions
        userId: `user-${i}`,
        additionalData: { role: i % 3 === 0 ? 'moderator' : 'viewer' },
      }));

      const startTime = Date.now();
      const participants = await participantFactory.createTestParticipants(mockParticipantService, participantConfigs);
      const endTime = Date.now();

      // Should create all participants
      assert.strictEqual(participants.length, participantCount);

      // Should complete within reasonable time (less than 5 seconds for 40 participants)
      assert.ok(endTime - startTime < 5000);

      // All participants should be tracked
      assert.strictEqual(context.getTracked('participants').length, participantCount);
    });

    it('should handle cache performance with many different participants', async () => {
      const participantCount = 20;

      // Create many different participants
      for (let i = 0; i < participantCount; i++) {
        await participantFactory.createTestParticipant(
          mockParticipantService,
          `session-${i % 3}`, // 3 different sessions
          `user-${i}`,
          {
            role: i % 2 === 0 ? 'viewer' : 'moderator',
            permissions: [`perm-${i}`],
          },
        );
      }

      const stats = cacheManager.getCacheStats();
      assert.strictEqual(stats.sets, participantCount);
      assert.ok(stats.size <= cacheManager.getConfig().maxSize);
    });

    it('should handle concurrent participant creation', async () => {
      const participantPromises = [];

      // Create participants concurrently
      for (let i = 0; i < 10; i++) {
        participantPromises.push(
          participantFactory.createTestParticipant(mockParticipantService, `session-${i}`, `user-${i}`, {
            role: 'viewer',
          }),
        );
      }

      const participants = await Promise.all(participantPromises);

      // All should be created successfully
      assert.strictEqual(participants.length, 10);
      participants.forEach((participant) => {
        assert.ok(participant.id);
        assert.ok(participant.sessionId);
        assert.ok(participant.userId);
      });

      // All should be tracked
      assert.strictEqual(context.getTracked('participants').length, 10);
    });
  });

  describe('edge cases', () => {
    it('should handle participants with same session and user but different roles', async () => {
      // Create participants with same session/user but different roles
      const participant1 = await participantFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
        { role: 'viewer' },
      );

      const participant2 = await participantFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
        { role: 'moderator' },
      );

      // Should be different objects due to different cache keys
      assert.notStrictEqual(participant1, participant2);

      // But should have same session and user IDs
      assert.strictEqual(participant1.sessionId, participant2.sessionId);
      assert.strictEqual(participant1.userId, participant2.userId);
      assert.notStrictEqual(participant1.role, participant2.role);
    });

    it('should handle participants with very long IDs', async () => {
      const longSessionId = 'session-' + 'a'.repeat(100);
      const longUserId = 'user-' + 'b'.repeat(100);

      const participant = await participantFactory.createTestParticipant(
        mockParticipantService,
        longSessionId,
        longUserId,
        { role: 'viewer' },
      );

      // Should handle long IDs correctly
      assert.ok(participant.id);
      assert.strictEqual(participant.sessionId, longSessionId);
      assert.strictEqual(participant.userId, longUserId);
      assert.strictEqual(participant.role, 'viewer');
    });

    it('should handle participants with special characters in data', async () => {
      const specialData = {
        role: 'viewer',
        metadata: {
          deviceInfo: 'iPhone 13 Pro Max (Chrome/91.0)',
          location: 'New York, NY, USA',
          tags: ['special-chars', 'émojis-🚀', 'unicode-字符'],
        },
      };

      const participant = await participantFactory.createTestParticipant(
        mockParticipantService,
        mockSessionId,
        mockUserId,
        specialData,
      );

      // Should handle special characters correctly
      assert.strictEqual(participant.role, 'viewer');
      assert.strictEqual(participant.metadata.deviceInfo, 'iPhone 13 Pro Max (Chrome/91.0)');
      assert.strictEqual(participant.metadata.location, 'New York, NY, USA');
      assert.deepStrictEqual(participant.metadata.tags, ['special-chars', 'émojis-🚀', 'unicode-字符']);
    });
  });
});
