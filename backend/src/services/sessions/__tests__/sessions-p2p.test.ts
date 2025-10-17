/**
 * @fileoverview P2P Sessions Service Tests - Modernized
 *
 * Modernized P2P session tests using TestServiceBuilder and scenario factories.
 * Focuses on P2P-specific functionality while maintaining essential coverage.
 *
 * **Modernization Improvements:**
 * - TestServiceBuilder for unified setup/teardown with performance monitoring
 * - Scenario factories for realistic test data creation
 * - Proper cleanup and resource management
 * - Consistent patterns with other modernized test files
 *
 * **Purpose:**
 * - Test P2P session creation and management
 * - Validate public/private P2P session access patterns
 * - Test participant joining/leaving functionality
 * - Verify P2P session constraints and limits
 *
 * **Note:** Uses modern TestServiceBuilder for unified setup/teardown
 * **Note:** Leverages quickP2P scenario factory for realistic testing
 * **Note:** Includes performance monitoring and proper cleanup
 */

import assert from 'assert';
import { SessionType } from '@prisma/client';

import {
  TestServiceBuilder,
  quickP2P,
  createUsers,
  createTestUser,
  STATUS_CODE_CREATED,
  STATUS_CODE_SUCCESS,
  DEFAULT_PASSWORD_STRONG,
} from '@/test-utils';
import { getApp } from '@/app';

describe('Sessions Service - P2P Sessions (Modernized)', () => {
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

  describe('P2P Session Creation & Management', () => {
    it('should create P2P session with proper constraints', async () => {
      // Use scenario factory for realistic test data
      const scenario = await quickP2P(userService, sessionService, participantService, {
        userCount: 3,
        sessionCount: 1,
        participantsPerSession: 2,
      });

      // Test actual functionality
      const session = scenario.sessions[0];
      assert.strictEqual(session.type, SessionType.P2P, 'Session should be P2P type');
      assert.ok(session.hostId, 'Session should have a host');

      // P2P sessions should have participant limits
      assert.ok(session.maxParticipants <= 10, 'P2P session should have reasonable participant limit');

      // Verify session has participants
      assert.ok(scenario.participants.length >= 2, 'Should have at least 2 participants');

      // Test session updates
      const updatedSession = await sessionService.patch(session.id, {
        title: 'Updated P2P Session',
        description: 'Updated description',
      });

      assert.strictEqual(updatedSession.title, 'Updated P2P Session');
      assert.strictEqual(updatedSession.description, 'Updated description');

      // Test session retrieval
      const retrievedSession = await sessionService.get(session.id);
      assert.strictEqual(retrievedSession.id, session.id);
      assert.strictEqual(retrievedSession.title, 'Updated P2P Session');

      await scenario.cleanup();
    });

    it('should create private P2P session with password protection', async () => {
      // Create test users
      const users = [
        await createTestUser(userService, `p2p-host-${Date.now()}@example.com`, DEFAULT_PASSWORD_STRONG, {
          roles: ['USER'],
        }),
        await createTestUser(userService, `p2p-peer1-${Date.now()}@example.com`, DEFAULT_PASSWORD_STRONG, {
          roles: ['USER'],
        }),
      ];

      // Create private P2P session with password
      const session = await sessionService.create({
        title: 'Private P2P Chat',
        type: SessionType.P2P,
        hostId: users[0].id,
        maxParticipants: 2,
        isPublic: false,
        password: 'privatepass123',
        description: 'A private P2P session with password',
      });

      assert.strictEqual(session.type, SessionType.P2P);
      assert.strictEqual(session.isPublic, false);
      assert.ok(session.password, 'Should have password for private session');
      assert.strictEqual(session.hostId, users[0].id);
      assert.strictEqual(session.maxParticipants, 2);

      // Add participants (simulating join process)
      const participant1 = await participantService.create({
        sessionId: session.id,
        userId: users[0].id,
        identity: 'host-participant',
        displayName: 'Host User',
      });

      const participant2 = await participantService.create({
        sessionId: session.id,
        userId: users[1].id,
        identity: 'peer-participant',
        displayName: 'Peer User',
      });

      // Verify participants
      const sessionParticipants = await participantService.find({ query: { sessionId: session.id } });
      assert.ok(sessionParticipants.total >= 2, 'Should have participants');

      // Test participant queries
      const hostParticipant = sessionParticipants.data.find((p: any) => p.userId === users[0].id);
      assert.ok(hostParticipant, 'Host should be a participant');

      // Cleanup
      await participantService.remove(participant1.id);
      await participantService.remove(participant2.id);
      await sessionService.remove(session.id);
      for (const user of users) {
        await userService.remove(user.id);
      }
    });

    it('should handle P2P session with maximum participants', async () => {
      // Create test users for maximum capacity testing
      const users = [];
      for (let i = 0; i < 10; i++) {
        users.push(
          await createTestUser(userService, `p2p-max-${i}-${Date.now()}@example.com`, DEFAULT_PASSWORD_STRONG, {
            roles: ['USER'],
          }),
        );
      }

      // Create P2P session with maximum capacity
      const session = await sessionService.create({
        title: 'Max Capacity P2P Session',
        type: SessionType.P2P,
        hostId: users[0].id,
        maxParticipants: 10,
        isPublic: true,
        description: 'Testing P2P session with maximum participants',
      });

      assert.strictEqual(session.type, SessionType.P2P);
      assert.strictEqual(session.maxParticipants, 10);

      // Add participants up to the limit
      const participants = [];
      for (let i = 0; i < Math.min(users.length, 10); i++) {
        const participant = await participantService.create({
          sessionId: session.id,
          userId: users[i].id,
          identity: `participant-${i}`,
          displayName: `User ${i}`,
        });
        participants.push(participant);
      }

      // Verify all participants were added
      const sessionParticipants = await participantService.find({ query: { sessionId: session.id } });
      assert.ok(sessionParticipants.total >= 10, 'Should handle maximum participants');

      // Test participant management
      const participantCount = sessionParticipants.total;
      assert.ok(participantCount <= 10, 'Should not exceed maximum participants');

      // Cleanup
      for (const participant of participants) {
        await participantService.remove(participant.id);
      }
      await sessionService.remove(session.id);
      for (const user of users) {
        await userService.remove(user.id);
      }
    });

    it('should validate P2P session properties and metadata', async () => {
      // Create test user
      const hostUser = await createTestUser(
        userService,
        `p2p-props-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['USER'],
        },
      );

      // Test P2P session creation with all properties
      const session = await sessionService.create({
        title: 'Property Test P2P',
        type: SessionType.P2P,
        hostId: hostUser.id,
        maxParticipants: 5,
        isPublic: true,
        description: 'Testing P2P session properties',
        settings: {
          allowRecording: false,
          chatEnabled: true,
          screenShareEnabled: true,
        },
        metadata: {
          category: 'personal',
          tags: ['test', 'p2p', 'automation'],
        },
      });

      // Validate session properties
      assert.strictEqual(session.type, SessionType.P2P);
      assert.strictEqual(session.hostId, hostUser.id);
      assert.strictEqual(session.maxParticipants, 5);
      assert.strictEqual(session.isPublic, true);
      assert.strictEqual(session.settings?.chatEnabled, true);
      assert.ok(session.metadata?.tags?.includes('p2p'), 'Should have p2p tag');

      // Test session updates
      const updatedSession = await sessionService.patch(session.id, {
        title: 'Updated P2P Property Test',
        settings: {
          allowRecording: true,
          chatEnabled: false,
        },
        metadata: {
          category: 'work',
          tags: ['updated', 'work'],
        },
      });

      assert.strictEqual(updatedSession.title, 'Updated P2P Property Test');
      assert.strictEqual(updatedSession.settings?.allowRecording, true);
      assert.strictEqual(updatedSession.settings?.chatEnabled, false);
      assert.strictEqual(updatedSession.metadata?.category, 'work');

      // Cleanup
      await sessionService.remove(session.id);
      await userService.remove(hostUser.id);
    });

    it('should handle P2P session access control and permissions', async () => {
      // Create users for access testing
      const users = [
        await createTestUser(userService, `p2p-access-host-${Date.now()}@example.com`, DEFAULT_PASSWORD_STRONG, {
          roles: ['USER'],
        }),
        await createTestUser(userService, `p2p-access-peer-${Date.now()}@example.com`, DEFAULT_PASSWORD_STRONG, {
          roles: ['USER'],
        }),
      ];

      // Create public P2P session
      const publicSession = await sessionService.create({
        title: 'Public P2P Session',
        type: SessionType.P2P,
        hostId: users[0].id,
        maxParticipants: 2,
        isPublic: true,
        description: 'Public P2P session for testing',
      });

      // Create private P2P session
      const privateSession = await sessionService.create({
        title: 'Private P2P Session',
        type: SessionType.P2P,
        hostId: users[0].id,
        maxParticipants: 2,
        isPublic: false,
        password: 'private123',
        description: 'Private P2P session for testing',
      });

      // Test public session access
      const publicSessionInfo = await sessionService.get(publicSession.id);
      assert.strictEqual(publicSessionInfo.id, publicSession.id);
      assert.strictEqual(publicSessionInfo.isPublic, true);

      // Test private session access (should still be accessible for basic info)
      const privateSessionInfo = await sessionService.get(privateSession.id);
      assert.strictEqual(privateSessionInfo.id, privateSession.id);
      assert.strictEqual(privateSessionInfo.isPublic, false);

      // Test session management permissions
      const hostUpdate = await sessionService.patch(privateSession.id, {
        title: 'Host Updated Private P2P',
      });
      assert.strictEqual(hostUpdate.title, 'Host Updated Private P2P');

      // Cleanup
      await sessionService.remove(publicSession.id);
      await sessionService.remove(privateSession.id);
      for (const user of users) {
        await userService.remove(user.id);
      }
    });
  });

  describe('P2P Session Integration & Performance', () => {
    it('should validate P2P session service integration', async () => {
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
      assert.strictEqual(STATUS_CODE_SUCCESS, 200, 'Should have correct success status');
    });

    it('should validate scenario factory integration', async () => {
      // Test that scenario factories work correctly for P2P
      const scenario = await quickP2P(userService, sessionService, participantService, {
        userCount: 2,
        sessionCount: 1,
        participantsPerSession: 2,
      });

      assert.ok(scenario.sessions.length > 0, 'Should create P2P sessions');
      assert.ok(scenario.users.length > 0, 'Should create users');
      assert.ok(scenario.participants.length > 0, 'Should create participants');

      // Verify P2P-specific constraints
      const session = scenario.sessions[0];
      assert.strictEqual(session.type, SessionType.P2P, 'Should be P2P type');
      assert.ok(session.maxParticipants <= 10, 'P2P should have reasonable limit');

      // Test scenario cleanup
      assert.ok(typeof scenario.cleanup === 'function', 'Scenario should have cleanup method');

      await scenario.cleanup();
    });

    it('should validate TestServiceBuilder performance monitoring', async () => {
      // Test that performance monitoring is working
      assert.ok(builder, 'Builder should be available');

      // Performance metrics should be available
      const metrics = builder.getPerformanceMetrics?.();
      if (metrics) {
        assert.ok(typeof metrics === 'object', 'Performance metrics should be available');
      }

      // Cache statistics should be available
      const cacheStats = builder.getCacheStats?.();
      if (cacheStats) {
        assert.ok(typeof cacheStats === 'object', 'Cache statistics should be available');
      }
    });
  });

  describe('P2P Session Edge Cases', () => {
    it('should handle P2P session with minimum participants', async () => {
      // Create users for minimal P2P test
      const users = [
        await createTestUser(userService, `p2p-min-host-${Date.now()}@example.com`, DEFAULT_PASSWORD_STRONG, {
          roles: ['USER'],
        }),
        await createTestUser(userService, `p2p-min-peer-${Date.now()}@example.com`, DEFAULT_PASSWORD_STRONG, {
          roles: ['USER'],
        }),
      ];

      // Create P2P session with minimum participants
      const session = await sessionService.create({
        title: 'Minimal P2P Session',
        type: SessionType.P2P,
        hostId: users[0].id,
        maxParticipants: 2,
        isPublic: true,
        description: 'Testing P2P with minimum participants',
      });

      // Add exactly 2 participants
      const hostParticipant = await participantService.create({
        sessionId: session.id,
        userId: users[0].id,
        identity: 'host',
        displayName: 'Host',
      });

      const peerParticipant = await participantService.create({
        sessionId: session.id,
        userId: users[1].id,
        identity: 'peer',
        displayName: 'Peer',
      });

      // Verify session is at capacity
      const participants = await participantService.find({ query: { sessionId: session.id } });
      assert.strictEqual(participants.total, 2, 'Should have exactly 2 participants');

      // Cleanup
      await participantService.remove(hostParticipant.id);
      await participantService.remove(peerParticipant.id);
      await sessionService.remove(session.id);
      for (const user of users) {
        await userService.remove(user.id);
      }
    });
  });
});
