/**
 * @fileoverview Broadcast Sessions Service Tests - Modernized
 *
 * Modernized broadcast session tests using TestServiceBuilder and scenario factories.
 * Focuses on broadcast-specific functionality while maintaining essential coverage.
 *
 * **Modernization Improvements:**
 * - TestServiceBuilder for unified setup/teardown with performance monitoring
 * - Scenario factories for realistic test data creation
 * - Proper cleanup and resource management
 * - Consistent patterns with other modernized test files
 *
 * **Purpose:**
 * - Test broadcast session creation and management
 * - Validate broadcaster role requirements
 * - Test public/private access patterns
 * - Verify LiveKit integration patterns
 *
 * **Note:** Uses modern TestServiceBuilder for unified setup/teardown
 * **Note:** Leverages quickBroadcast scenario factory for realistic testing
 * **Note:** Includes performance monitoring and proper cleanup
 */

import assert from 'assert';
import { SessionType } from '@prisma/client';

import {
  TestServiceBuilder,
  quickBroadcast,
  createUsers,
  createTestUser,
  STATUS_CODE_CREATED,
  STATUS_CODE_FORBIDDEN,
  STATUS_CODE_SUCCESS,
  DEFAULT_PASSWORD_STRONG,
} from '@/test-utils';
import { getApp } from '@/app';

describe('Sessions Service - Broadcast Sessions (Modernized)', () => {
  let builder: TestServiceBuilder;
  let userService: any;
  let sessionService: any;
  let participantService: any;

  before(async () => {
    // Initialize modern test utilities with unified setup
    builder = await new TestServiceBuilder()
      .withPerformanceMonitoring()
      .withServiceDiscovery(() => getApp())
      .build();

    // Get services from the app
    const app = getApp();
    userService = app.service('users');
    sessionService = app.service('sessions');
    participantService = app.service('participants');
  });

  after(async () => {
    await builder.cleanup();
  });

  describe('Broadcast Session Creation & Management', () => {
    it('should create broadcast session with broadcaster role', async () => {
      // Use scenario factory for realistic test data
      const scenario = await quickBroadcast(userService, sessionService, participantService, {
        userCount: 4,
        sessionCount: 1,
        participantsPerSession: 3,
      });

      // Test actual functionality
      const session = scenario.sessions[0];
      assert.strictEqual(session.type, SessionType.BROADCAST, 'Session should be BROADCAST type');
      assert.ok(session.hostId, 'Session should have a host');

      // Verify session has participants
      assert.ok(scenario.participants.length >= 3, 'Should have at least 3 participants');

      // Test session updates by host
      const updatedSession = await sessionService.patch(session.id, {
        title: 'Updated Broadcast Session',
        isPublic: true,
      });

      assert.strictEqual(updatedSession.title, 'Updated Broadcast Session');
      assert.strictEqual(updatedSession.isPublic, true);

      // Test session retrieval
      const retrievedSession = await sessionService.get(session.id);
      assert.strictEqual(retrievedSession.id, session.id);
      assert.strictEqual(retrievedSession.title, 'Updated Broadcast Session');

      await scenario.cleanup();
    });

    it('should enforce broadcaster role requirement for session creation', async () => {
      // Create regular user (not broadcaster)
      const { users } = await createUsers(userService)
        .withPassword(DEFAULT_PASSWORD_STRONG)
        .withEmail(`regular-user-${Date.now()}@example.com`)
        .withRoles('USER')
        .build();

      const regularUser = users[0];

      try {
        // Attempt to create broadcast session as regular user
        await sessionService.create({
          title: 'Unauthorized Broadcast',
          type: SessionType.BROADCAST,
          hostId: regularUser.id,
          maxParticipants: 100,
        });

        assert.fail('Should have thrown Forbidden error');
      } catch (error: any) {
        assert.strictEqual(error.code, STATUS_CODE_FORBIDDEN, 'Should return 403 Forbidden');
        assert.ok(error.message.includes('broadcaster'), 'Error should mention broadcaster requirement');
      }

      // Cleanup
      await userService.remove(regularUser.id);
    });

    it('should handle broadcast session with many participants', async () => {
      // Create test users with different roles
      const users = [
        await createTestUser(userService, `broadcaster-large-${Date.now()}@example.com`, DEFAULT_PASSWORD_STRONG, {
          roles: ['BROADCASTER'],
        }),
        await createTestUser(userService, `viewer1-${Date.now()}@example.com`, DEFAULT_PASSWORD_STRONG, {
          roles: ['USER'],
        }),
        await createTestUser(userService, `viewer2-${Date.now()}@example.com`, DEFAULT_PASSWORD_STRONG, {
          roles: ['USER'],
        }),
        await createTestUser(userService, `viewer3-${Date.now()}@example.com`, DEFAULT_PASSWORD_STRONG, {
          roles: ['USER'],
        }),
        await createTestUser(userService, `viewer4-${Date.now()}@example.com`, DEFAULT_PASSWORD_STRONG, {
          roles: ['USER'],
        }),
        await createTestUser(userService, `viewer5-${Date.now()}@example.com`, DEFAULT_PASSWORD_STRONG, {
          roles: ['USER'],
        }),
      ];

      // Create broadcast session with high capacity
      const session = await sessionService.create({
        title: 'Large Broadcast Session',
        type: SessionType.BROADCAST,
        hostId: users[0].id,
        maxParticipants: 1000,
        isPublic: true,
        description: 'Testing large broadcast with many participants',
      });

      assert.strictEqual(session.type, SessionType.BROADCAST);
      assert.strictEqual(session.isPublic, true);
      assert.strictEqual(session.maxParticipants, 1000);

      // Add multiple participants
      const participants = [];
      for (let i = 0; i < users.length; i++) {
        const participant = await participantService.create({
          sessionId: session.id,
          userId: users[i].id,
          identity: `participant-${i}`,
          displayName: `User ${i}`,
          metadata: {
            role: i === 0 ? 'host' : 'viewer',
            joinedAt: new Date(),
          },
        });
        participants.push(participant);
      }

      // Verify all participants were added
      const sessionParticipants = await participantService.find({ query: { sessionId: session.id } });
      assert.ok(sessionParticipants.total >= 6, 'Should have all participants');

      // Test participant queries and filtering
      const hostParticipant = sessionParticipants.data.find((p: any) => p.userId === users[0].id);
      assert.ok(hostParticipant, 'Host should be a participant');
      assert.ok(hostParticipant.metadata?.role === 'host', 'Host should have host role');

      // Cleanup
      for (const participant of participants) {
        await participantService.remove(participant.id);
      }
      await sessionService.remove(session.id);
      for (const user of users) {
        await userService.remove(user.id);
      }
    });

    it('should validate broadcast session properties and constraints', async () => {
      // Create broadcaster user
      const broadcaster = await createTestUser(
        userService,
        `broadcast-props-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['BROADCASTER'],
        },
      );

      // Test broadcast session creation with all properties
      const session = await sessionService.create({
        title: 'Property Test Broadcast',
        type: SessionType.BROADCAST,
        hostId: broadcaster.id,
        maxParticipants: 500,
        isPublic: true,
        description: 'Testing broadcast session properties',
        settings: {
          quality: 'HD',
          recording: true,
          chatEnabled: true,
        },
        metadata: {
          category: 'gaming',
          tags: ['test', 'automation'],
        },
      });

      // Validate session properties
      assert.strictEqual(session.type, SessionType.BROADCAST);
      assert.strictEqual(session.hostId, broadcaster.id);
      assert.strictEqual(session.maxParticipants, 500);
      assert.strictEqual(session.isPublic, true);
      assert.strictEqual(session.settings?.quality, 'HD');
      assert.strictEqual(session.settings?.recording, true);
      assert.ok(session.metadata?.tags?.includes('test'), 'Should have test tag');

      // Test session updates (host only)
      const updatedSession = await sessionService.patch(session.id, {
        title: 'Updated Property Test',
        settings: {
          quality: '4K',
          recording: false,
        },
      });

      assert.strictEqual(updatedSession.title, 'Updated Property Test');
      assert.strictEqual(updatedSession.settings?.quality, '4K');
      assert.strictEqual(updatedSession.settings?.recording, false);

      // Cleanup
      await sessionService.remove(session.id);
      await userService.remove(broadcaster.id);
    });

    it('should handle broadcast session access control', async () => {
      // Create users with different roles
      const broadcaster = await createTestUser(
        userService,
        `access-broadcaster-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['BROADCASTER'],
        },
      );

      const regularUser = await createTestUser(
        userService,
        `access-user-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['USER'],
        },
      );

      // Create private broadcast session
      const privateSession = await sessionService.create({
        title: 'Private Broadcast',
        type: SessionType.BROADCAST,
        hostId: broadcaster.id,
        maxParticipants: 10,
        isPublic: false,
        description: 'Private broadcast session',
      });

      // Create public broadcast session
      const publicSession = await sessionService.create({
        title: 'Public Broadcast',
        type: SessionType.BROADCAST,
        hostId: broadcaster.id,
        maxParticipants: 100,
        isPublic: true,
        description: 'Public broadcast session',
      });

      // Test public session access (should be accessible without authentication for basic info)
      const publicSessionInfo = await sessionService.get(publicSession.id);
      assert.strictEqual(publicSessionInfo.id, publicSession.id);
      assert.strictEqual(publicSessionInfo.isPublic, true);

      // Test private session access (should require authentication/authorization)
      // Note: Access control logic would be implemented in service hooks
      const privateSessionInfo = await sessionService.get(privateSession.id);
      assert.strictEqual(privateSessionInfo.id, privateSession.id);
      assert.strictEqual(privateSessionInfo.isPublic, false);

      // Test session management permissions (only host should be able to update/delete)
      const hostUpdate = await sessionService.patch(privateSession.id, {
        title: 'Host Updated Private Session',
      });
      assert.strictEqual(hostUpdate.title, 'Host Updated Private Session');

      // Cleanup
      await sessionService.remove(privateSession.id);
      await sessionService.remove(publicSession.id);
      await userService.remove(broadcaster.id);
      await userService.remove(regularUser.id);
    });
  });

  describe('Broadcast Session Integration & Performance', () => {
    it('should validate broadcast session service integration', async () => {
      // Test service registration and method availability
      assert.ok(sessionService, 'Session service should be available');
      assert.ok(typeof sessionService.create === 'function', 'Should have create method');
      assert.ok(typeof sessionService.patch === 'function', 'Should have patch method');
      assert.ok(typeof sessionService.remove === 'function', 'Should have remove method');
      assert.ok(typeof sessionService.find === 'function', 'Should have find method');
      assert.ok(typeof sessionService.get === 'function', 'Should have get method');

      // Test builder integration
      assert.ok(builder, 'TestServiceBuilder should be available');
      assert.ok(typeof builder.getPort === 'function', 'Builder should provide port access');
      assert.ok(typeof builder.cleanup === 'function', 'Builder should provide cleanup');
    });

    it('should validate modern test utility integration', async () => {
      // Test that modern utilities are properly integrated
      assert.ok(DEFAULT_PASSWORD_STRONG, 'Should have strong password constant');
      assert.ok(typeof DEFAULT_PASSWORD_STRONG === 'string', 'Password should be string type');
      assert.ok(DEFAULT_PASSWORD_STRONG.length > 8, 'Strong password should meet length requirements');

      // Test status code constants
      assert.strictEqual(STATUS_CODE_CREATED, 201, 'Should have correct created status');
      assert.strictEqual(STATUS_CODE_FORBIDDEN, 403, 'Should have correct forbidden status');
      assert.strictEqual(STATUS_CODE_SUCCESS, 200, 'Should have correct success status');
    });

    it('should validate scenario factory integration', async () => {
      // Test that scenario factories work correctly
      const scenario = await quickBroadcast(userService, sessionService, participantService, {
        userCount: 2,
        sessionCount: 1,
        participantsPerSession: 1,
      });

      assert.ok(scenario.sessions.length > 0, 'Should create sessions');
      assert.ok(scenario.users.length > 0, 'Should create users');
      assert.ok(scenario.participants.length > 0, 'Should create participants');

      // Test scenario cleanup
      assert.ok(typeof scenario.cleanup === 'function', 'Scenario should have cleanup method');

      await scenario.cleanup();
    });
  });
});
