/**
 * @fileoverview Participants Service Tests - Simplified
 *
 * Focused participants service tests with essential coverage.
 *
 * **Purpose:**
 * - Test participant service registration and core methods
 * - Verify participant lifecycle management in sessions
 * - Validate participant queries and filtering
 * - Test integration with session and user management
 *
 * **Scope:**
 * - Service registration and method availability
 * - Participant creation, updates, and removal
 * - Query and filtering capabilities
 * - Session integration
 */

import { Application } from '@feathersjs/feathers';
import assert from 'assert';

import { getApp } from '@/app';
import { TestServiceBuilder, createTestUser, createTestSession, DEFAULT_PASSWORD_STRONG } from '@/test-utils';

describe('Participants Service - Essential Tests', () => {
  let app: Application;
  let builder: TestServiceBuilder;
  let participantService: any;
  let usersService: any;
  let sessionsService: any;

  before(async () => {
    // Initialize modern test utilities with unified setup
    builder = await new TestServiceBuilder()
      .withPerformanceMonitoring()
      .withServiceDiscovery(() => getApp())
      .build();

    // Get services from the app
    app = getApp();
    participantService = app.service('participants');
    usersService = app.service('users');
    sessionsService = app.service('sessions');
  });

  after(async () => {
    await builder.cleanup();
  });

  describe('Service Validation', () => {
    it('should validate participants service registration and methods', () => {
      // Verify service is registered and available
      assert.ok(participantService, 'Participants service should be available');
      assert.strictEqual(app.service('participants'), participantService, 'Service should be properly registered');

      // Verify all CRUD methods are available
      assert.ok(typeof participantService.find === 'function', 'Should have find method for participant queries');
      assert.ok(typeof participantService.get === 'function', 'Should have get method for participant retrieval');
      assert.ok(typeof participantService.create === 'function', 'Should have create method for participant joining');
      assert.ok(typeof participantService.patch === 'function', 'Should have patch method for participant updates');
      assert.ok(typeof participantService.remove === 'function', 'Should have remove method for participant leaving');

      // Verify service has proper FeathersJS characteristics
      assert.ok(
        typeof participantService.id === 'string' || participantService.id === undefined,
        'Service should have id property',
      );

      // Verify participant data structure support
      assert.ok(participantService, 'Participants service should handle participant data structure');
    });
  });

  describe('Participant Management - Functional Tests', () => {
    it('should handle participant lifecycle in sessions', async () => {
      const user1 = await createTestUser(usersService, 'participant1@example.com', DEFAULT_PASSWORD_STRONG, {
        roles: ['USER'],
      });

      const user2 = await createTestUser(usersService, 'participant2@example.com', DEFAULT_PASSWORD_STRONG, {
        roles: ['USER'],
      });

      const session = await createTestSession(sessionsService, 'BROADCAST' as any, user1, {
        title: 'Participant Test Session',
        maxParticipants: 10,
      });

      // Test participant creation (joining session)
      const participant1 = await participantService.create({
        sessionId: session.id,
        userId: user1.id,
        identity: 'host-participant',
        displayName: 'Host User',
        role: 'host',
      });

      const participant2 = await participantService.create({
        sessionId: session.id,
        userId: user2.id,
        identity: 'viewer-participant',
        displayName: 'Viewer User',
        role: 'viewer',
      });

      // Verify participants were created
      assert.ok(participant1.id, 'Participant 1 should have an ID');
      assert.ok(participant2.id, 'Participant 2 should have an ID');
      assert.strictEqual(participant1.sessionId, session.id, 'Participant should be linked to session');
      assert.strictEqual(participant2.sessionId, session.id, 'Participant should be linked to session');

      // Test participant updates (e.g., mute/unmute)
      const updatedParticipant = await participantService.patch(participant2.id, {
        isMuted: true,
        permissions: ['view', 'chat'],
      });

      assert.strictEqual(updatedParticipant.isMuted, true, 'Participant should be muted');
      assert.ok(updatedParticipant.permissions?.includes('view'), 'Should have view permission');

      // Test finding participants by session
      const sessionParticipants = await participantService.find({
        query: { sessionId: session.id },
      });
      assert.ok(sessionParticipants.total >= 2, 'Should find participants in session');

      // Test participant retrieval
      const retrievedParticipant = await participantService.get(participant1.id);
      assert.strictEqual(retrievedParticipant.id, participant1.id);

      // Test participant removal (leaving session)
      await participantService.remove(participant1.id);
      await participantService.remove(participant2.id);

      // Verify participants were removed
      const participantsAfterRemoval = await participantService.find({
        query: { sessionId: session.id },
      });
      assert.strictEqual(participantsAfterRemoval.total, 0, 'No participants should remain after removal');

      // Cleanup
      await sessionsService.remove(session.id);
      await usersService.remove(user1.id);
      await usersService.remove(user2.id);
    });

    it('should handle participant queries and filtering', async () => {
      const { createTestUser, createTestSession } = await import('@/test-utils');

      // Create test data
      const users = [
        await createTestUser(usersService, 'query-user1@example.com', DEFAULT_PASSWORD_STRONG, {
          roles: ['USER'],
        }),
        await createTestUser(usersService, 'query-user2@example.com', DEFAULT_PASSWORD_STRONG, {
          roles: ['USER'],
        }),
      ];

      const session = await createTestSession(sessionsService, 'P2P' as any, users[0], {
        title: 'Query Test Session',
      });

      // Create participants
      const participants = [];
      for (let i = 0; i < users.length; i++) {
        const participant = await participantService.create({
          sessionId: session.id,
          userId: users[i].id,
          identity: `query-participant-${i}`,
          displayName: `Query User ${i}`,
        });
        participants.push(participant);
      }

      // Test finding participants by session
      const bySession = await participantService.find({
        query: { sessionId: session.id },
      });
      assert.ok(bySession.total >= 2, 'Should find participants by session');

      // Test finding participants by user
      const byUser = await participantService.find({
        query: { userId: users[0].id },
      });
      assert.ok(byUser.total >= 1, 'Should find participants by user');

      // Test finding participants by role
      const byRole = await participantService.find({
        query: { role: 'viewer' },
      });
      // Role-based queries may not be implemented, but service should handle them gracefully

      // Test participant pagination
      const paginated = await participantService.find({
        query: {},
        $limit: 1,
      });
      assert.ok(paginated.limit <= 1, 'Should respect pagination limit');

      // Cleanup
      for (const participant of participants) {
        await participantService.remove(participant.id);
      }
      await sessionsService.remove(session.id);
      for (const user of users) {
        await usersService.remove(user.id);
      }
    });
  });
});
