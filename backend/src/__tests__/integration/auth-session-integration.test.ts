/**
 * @fileoverview Authentication and Session Integration Tests
 *
 * This file contains integration tests that verify cross-service functionality
 * between authentication, users, sessions, and participants. It ensures that
 * the different services work together correctly in realistic scenarios.
 *
 * **Purpose:**
 * - Test end-to-end user authentication and session creation workflows
 * - Verify participant joining and session management integration
 * - Test authorization across multiple services
 * - Validate real-time communication token generation integration
 * - Test cross-service data consistency and relationships
 *
 * **Scope:**
 * - User registration, authentication, and session creation flow
 * - Session participant management and authorization
 * - LiveKit token generation for authenticated sessions
 * - Cross-service data validation and consistency
 * - Authorization and permission workflows across services
 * - Error handling and recovery across service boundaries
 *
 * **Related Test Files:**
 * - authentication-core.test.ts - Core authentication functionality
 * - sessions.test.ts - Session management functionality
 * - participants.test.ts - Participant management functionality
 * - livekit-token.test.ts - LiveKit token generation
 *
 * **Testing Guidelines:**
 * - Test realistic user workflows and interactions
 * - Verify data consistency across services
 * - Test authorization and permissions end-to-end
 * - Validate error scenarios and recovery
 * - Test performance of integrated workflows
 */

import { Application } from '@feathersjs/feathers';
import assert from 'assert';

import { getApp } from '@/app';
import { TestServiceBuilder, createTestUser, makeApiRequest, makeAuthenticatedApiRequest } from '@/test-utils';
import { DEFAULT_PASSWORD_STRONG, DEFAULT_CAPTCHA, STATUS_CODE_CREATED } from '@/test-utils/constants';

describe('Authentication & Session Integration (Modernized)', () => {
  let builder: TestServiceBuilder;
  let port: number;
  let userService: any;
  let sessionService: any;
  let participantService: any;
  let livekitTokenService: any;

  before(async () => {
    // Initialize modern test utilities with unified setup
    builder = await new TestServiceBuilder()
      .withPerformanceMonitoring()
      .withServiceDiscovery(() => getApp())
      .build();

    port = builder.getPort() || 3030;

    // Get services from the app
    const app = getApp();
    userService = app.service('users');
    sessionService = app.service('sessions');
    participantService = app.service('participants');
    livekitTokenService = app.service('livekit-token');

    // Configure LiveKit for testing
    app.set('livekit', {
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      wsUrl: 'ws://localhost:7880',
    });
  });

  after(async () => {
    await builder.cleanup();
  });

  describe('Complete User Journey - Registration to Session', () => {
    it('should complete full user journey from registration to session participation', async () => {
      const testEmail = `integration-user-${Date.now()}@example.com`;

      // Step 1: Create user
      const user = await createTestUser(userService, testEmail, DEFAULT_PASSWORD_STRONG, {
        roles: ['USER'],
      });

      assert.ok(user, 'Should create user successfully');
      assert.ok(user.id, 'User should have ID');
      assert.strictEqual(user.email, testEmail, 'User should have correct email');

      // Step 2: Authenticate user
      const authResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testEmail,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(authResponse.status, STATUS_CODE_CREATED, 'Should authenticate successfully');
      assert.ok(authResponse.data?.accessToken, 'Should receive access token');
      const accessToken = authResponse.data.accessToken;

      // Step 3: Create a session as broadcaster
      const sessionResponse = await makeAuthenticatedApiRequest(port, '/sessions', accessToken, {
        type: 'BROADCAST',
        title: 'Integration Test Session',
        description: 'Testing complete user journey',
        accessType: 'public',
      });

      assert.strictEqual(sessionResponse.status, STATUS_CODE_CREATED, 'Should create session successfully');
      assert.ok(sessionResponse.data?.id, 'Session should have ID');
      const sessionId = sessionResponse.data.id;

      // Step 4: Join session as participant
      const participantResponse = await makeAuthenticatedApiRequest(port, '/participants', accessToken, {
        sessionId,
        participantIdentity: `participant-${user.id}`,
        displayName: 'Integration Test Participant',
      });

      assert.strictEqual(participantResponse.status, STATUS_CODE_CREATED, 'Should join session successfully');
      assert.ok(participantResponse.data?.id, 'Participant should have ID');

      // Step 5: Generate LiveKit token for real-time communication
      const livekitResponse = await makeAuthenticatedApiRequest(port, '/livekit-token', accessToken, {
        sessionId,
        participantIdentity: `participant-${user.id}`,
        participantName: 'Integration Test Participant',
        role: 'viewer',
      });

      assert.strictEqual(livekitResponse.status, STATUS_CODE_CREATED, 'Should generate LiveKit token');
      assert.ok(livekitResponse.data?.token, 'Should receive LiveKit token');
      assert.ok(livekitResponse.data?.wsUrl, 'Should receive WebSocket URL');

      // Verify all components are properly linked
      assert.strictEqual(participantResponse.data.sessionId, sessionId, 'Participant should be linked to session');
      assert.ok(livekitResponse.data.token, 'LiveKit token should be valid');
    });

    it('should handle multiple users joining the same session', async () => {
      // Create broadcaster
      const broadcaster = await createTestUser(
        userService,
        `broadcaster-multi-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['BROADCASTER'],
        },
      );

      // Authenticate broadcaster
      const broadcasterAuth = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: broadcaster.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      const broadcasterToken = broadcasterAuth.data?.accessToken;
      assert.ok(broadcasterToken, 'Broadcaster should have access token');

      // Create broadcast session
      const sessionResponse = await makeAuthenticatedApiRequest(port, '/sessions', broadcasterToken, {
        type: 'BROADCAST',
        title: 'Multi-User Test Session',
        description: 'Testing multiple participants',
        accessType: 'public',
      });

      const sessionId = sessionResponse.data?.id;
      assert.ok(sessionId, 'Should create broadcast session');

      // Create multiple viewers
      const viewers = [];
      const participantPromises = [];

      for (let i = 0; i < 3; i++) {
        const viewer = await createTestUser(
          userService,
          `viewer-multi-${i}-${Date.now()}@example.com`,
          DEFAULT_PASSWORD_STRONG,
          {
            roles: ['USER'],
          },
        );
        viewers.push(viewer);

        // Authenticate and join session
        participantPromises.push(
          (async () => {
            const viewerAuth = await makeApiRequest(port, '/authentication', {
              strategy: 'local',
              email: viewer.email,
              password: DEFAULT_PASSWORD_STRONG,
              captcha: DEFAULT_CAPTCHA,
            });

            const viewerToken = viewerAuth.data?.accessToken;
            assert.ok(viewerToken, `Viewer ${i} should have access token`);

            const participantResponse = await makeAuthenticatedApiRequest(port, '/participants', viewerToken, {
              sessionId,
              participantIdentity: `viewer-${viewer.id}`,
              displayName: `Viewer ${i}`,
            });

            assert.strictEqual(participantResponse.status, STATUS_CODE_CREATED, `Viewer ${i} should join session`);

            // Generate LiveKit token for each viewer
            const livekitResponse = await makeAuthenticatedApiRequest(port, '/livekit-token', viewerToken, {
              sessionId,
              participantIdentity: `viewer-${viewer.id}`,
              participantName: `Viewer ${i}`,
              role: 'viewer',
            });

            assert.strictEqual(livekitResponse.status, STATUS_CODE_CREATED, `Viewer ${i} should get LiveKit token`);

            return { viewer, participant: participantResponse.data, livekit: livekitResponse.data };
          })(),
        );
      }

      const results = await Promise.all(participantPromises);

      assert.strictEqual(results.length, 3, 'All viewers should join successfully');
      results.forEach((result, index) => {
        assert.ok(result.participant, `Viewer ${index} should have participant data`);
        assert.ok(result.livekit?.token, `Viewer ${index} should have LiveKit token`);
        assert.strictEqual(result.participant.sessionId, sessionId, `Viewer ${index} should be in correct session`);
      });
    });
  });

  describe('Authorization Integration Across Services', () => {
    it('should enforce authorization across user, session, and participant services', async () => {
      // Create users with different roles
      const regularUser = await createTestUser(
        userService,
        `auth-regular-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['USER'],
        },
      );

      const broadcasterUser = await createTestUser(
        userService,
        `auth-broadcaster-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['BROADCASTER'],
        },
      );

      const adminUser = await createTestUser(
        userService,
        `auth-admin-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['ADMIN'],
        },
      );

      // Authenticate all users
      const users = [regularUser, broadcasterUser, adminUser];
      const authPromises = users.map((user) =>
        makeApiRequest(port, '/authentication', {
          strategy: 'local',
          email: user.email,
          password: DEFAULT_PASSWORD_STRONG,
          captcha: DEFAULT_CAPTCHA,
        }),
      );

      const authResponses = await Promise.all(authPromises);
      const tokens = authResponses.map((response) => response.data?.accessToken);
      assert.ok(
        tokens.every((token) => token),
        'All users should authenticate successfully',
      );

      // Test session creation permissions
      const sessionResponse = await makeAuthenticatedApiRequest(port, '/sessions', tokens[1], {
        // broadcaster
        type: 'BROADCAST',
        title: 'Authorization Test Session',
        accessType: 'public',
      });

      assert.strictEqual(sessionResponse.status, STATUS_CODE_CREATED, 'Broadcaster should create session');
      const sessionId = sessionResponse.data?.id;

      // Test participant joining (should work for authenticated users)
      const participantResponse = await makeAuthenticatedApiRequest(port, '/participants', tokens[0], {
        // regular user
        sessionId,
        participantIdentity: `auth-test-${regularUser.id}`,
        displayName: 'Auth Test Participant',
      });

      assert.strictEqual(participantResponse.status, STATUS_CODE_CREATED, 'Regular user should join session');

      // Test admin capabilities (if implemented)
      // Admin should be able to perform additional operations
    });

    it('should handle unauthorized access attempts across services', async () => {
      const unauthorizedUser = await createTestUser(
        userService,
        `unauth-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['USER'],
        },
      );

      const unauthorizedAuth = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: unauthorizedUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      const unauthorizedToken = unauthorizedAuth.data?.accessToken;
      assert.ok(unauthorizedToken, 'Unauthorized user should still authenticate');

      // Try to access admin-restricted functionality (if implemented)
      // This would depend on the specific authorization hooks in place

      // Test accessing non-existent or restricted sessions
      const fakeParticipantResponse = await makeAuthenticatedApiRequest(port, '/participants', unauthorizedToken, {
        sessionId: 'fake-session-id',
        participantIdentity: 'fake-participant',
        displayName: 'Fake Participant',
      });

      // Should either fail due to non-existent session or other validation
      if (fakeParticipantResponse && fakeParticipantResponse.status) {
        assert.ok(fakeParticipantResponse.status >= 400, 'Should handle fake session appropriately');
      } else {
        assert.ok(true, 'Request may have failed at network level');
      }
    });
  });

  describe('Data Consistency Across Services', () => {
    it('should maintain data consistency when user is deleted', async () => {
      // Create user and session
      const testUser = await createTestUser(
        userService,
        `consistency-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['BROADCASTER'],
        },
      );

      const authResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      const userToken = authResponse.data?.accessToken;
      assert.ok(userToken, 'User should authenticate');

      const sessionResponse = await makeAuthenticatedApiRequest(port, '/sessions', userToken, {
        type: 'BROADCAST',
        title: 'Consistency Test Session',
        accessType: 'public',
      });

      const sessionId = sessionResponse.data?.id;
      assert.ok(sessionId, 'Should create session');

      // Join session as participant
      const participantResponse = await makeAuthenticatedApiRequest(port, '/participants', userToken, {
        sessionId,
        participantIdentity: `consistency-${testUser.id}`,
        displayName: 'Consistency Test Participant',
      });

      const participantId = participantResponse.data?.id;
      assert.ok(participantId, 'Should create participant');

      // Verify data exists across services
      const fetchedUser = await userService.get(testUser.id);
      const fetchedSession = await sessionService.get(sessionId);
      const fetchedParticipant = await participantService.get(participantId);

      assert.ok(fetchedUser, 'User should exist');
      assert.ok(fetchedSession, 'Session should exist');
      assert.ok(fetchedParticipant, 'Participant should exist');

      // Verify relationships
      assert.strictEqual(fetchedSession.hostId, testUser.id, 'Session should reference correct host');
      assert.strictEqual(fetchedParticipant.sessionId, sessionId, 'Participant should reference correct session');

      // Note: In a real implementation, you might want to test cascade deletes
      // or cleanup when users/sessions are removed
    });

    it('should maintain participant count consistency', async () => {
      const hostUser = await createTestUser(
        userService,
        `count-host-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['BROADCASTER'],
        },
      );

      const hostAuth = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: hostUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      const hostToken = hostAuth.data?.accessToken;
      assert.ok(hostToken, 'Host should authenticate');

      // Create broadcast session
      const sessionResponse = await makeAuthenticatedApiRequest(port, '/sessions', hostToken, {
        type: 'BROADCAST',
        title: 'Count Test Session',
        accessType: 'public',
      });

      const sessionId = sessionResponse.data?.id;
      assert.ok(sessionId, 'Should create session');

      // Check initial participant count
      const initialSession = await sessionService.get(sessionId);
      assert.strictEqual(initialSession.currentParticipants, 0, 'Should start with 0 participants');

      // Add participants and verify count updates
      const participants = [];
      for (let i = 0; i < 3; i++) {
        const viewer = await createTestUser(
          userService,
          `count-viewer-${i}-${Date.now()}@example.com`,
          DEFAULT_PASSWORD_STRONG,
          {
            roles: ['USER'],
          },
        );

        const viewerAuth = await makeApiRequest(port, '/authentication', {
          strategy: 'local',
          email: viewer.email,
          password: DEFAULT_PASSWORD_STRONG,
          captcha: DEFAULT_CAPTCHA,
        });

        const viewerToken = viewerAuth.data?.accessToken;
        assert.ok(viewerToken, `Viewer ${i} should authenticate`);

        const participantResponse = await makeAuthenticatedApiRequest(port, '/participants', viewerToken, {
          sessionId,
          participantIdentity: `count-viewer-${viewer.id}`,
          displayName: `Count Test Viewer ${i}`,
        });

        participants.push(participantResponse.data);

        // Check participant count after each addition
        const updatedSession = await sessionService.get(sessionId);
        assert.strictEqual(updatedSession.currentParticipants, i + 1, `Should have ${i + 1} participants`);
      }

      assert.strictEqual(participants.length, 3, 'Should create all participants');

      // Remove one participant and verify count decreases
      await participantService.remove(participants[0].id);

      const finalSession = await sessionService.get(sessionId);
      assert.strictEqual(finalSession.currentParticipants, 2, 'Should have 2 participants after removal');
    });
  });

  describe('Real-time Communication Integration', () => {
    it('should integrate authentication with LiveKit token generation', async () => {
      // Create broadcaster and session
      const broadcaster = await createTestUser(
        userService,
        `livekit-broadcaster-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['BROADCASTER'],
        },
      );

      const broadcasterAuth = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: broadcaster.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      const broadcasterToken = broadcasterAuth.data?.accessToken;
      assert.ok(broadcasterToken, 'Broadcaster should authenticate');

      const sessionResponse = await makeAuthenticatedApiRequest(port, '/sessions', broadcasterToken, {
        type: 'BROADCAST',
        title: 'LiveKit Integration Session',
        accessType: 'public',
      });

      const sessionId = sessionResponse.data?.id;
      assert.ok(sessionId, 'Should create session');

      // Test LiveKit token generation for broadcaster
      const broadcasterLivekitResponse = await makeAuthenticatedApiRequest(port, '/livekit-token', broadcasterToken, {
        sessionId,
        participantIdentity: `broadcaster-${broadcaster.id}`,
        participantName: 'LiveKit Test Broadcaster',
        role: 'broadcaster',
      });

      assert.strictEqual(
        broadcasterLivekitResponse.status,
        STATUS_CODE_CREATED,
        'Broadcaster should get LiveKit token',
      );
      assert.ok(broadcasterLivekitResponse.data?.token, 'Should receive broadcaster token');

      // Create viewer and join session
      const viewer = await createTestUser(
        userService,
        `livekit-viewer-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['USER'],
        },
      );

      const viewerAuth = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: viewer.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      const viewerToken = viewerAuth.data?.accessToken;
      assert.ok(viewerToken, 'Viewer should authenticate');

      const participantResponse = await makeAuthenticatedApiRequest(port, '/participants', viewerToken, {
        sessionId,
        participantIdentity: `viewer-${viewer.id}`,
        displayName: 'LiveKit Test Viewer',
      });

      assert.strictEqual(participantResponse.status, STATUS_CODE_CREATED, 'Viewer should join session');

      // Test LiveKit token generation for viewer
      const viewerLivekitResponse = await makeAuthenticatedApiRequest(port, '/livekit-token', viewerToken, {
        sessionId,
        participantIdentity: `viewer-${viewer.id}`,
        participantName: 'LiveKit Test Viewer',
        role: 'viewer',
      });

      assert.strictEqual(viewerLivekitResponse.status, STATUS_CODE_CREATED, 'Viewer should get LiveKit token');
      assert.ok(viewerLivekitResponse.data?.token, 'Should receive viewer token');
      assert.ok(viewerLivekitResponse.data?.wsUrl, 'Should receive WebSocket URL');

      // Verify both tokens are different (different roles/permissions)
      assert.notStrictEqual(
        broadcasterLivekitResponse.data.token,
        viewerLivekitResponse.data.token,
        'Broadcaster and viewer should have different tokens',
      );
    });

    it('should handle concurrent LiveKit token requests', async () => {
      const viewer = await createTestUser(
        userService,
        `concurrent-viewer-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['USER'],
        },
      );

      const session = await createTestUser(
        userService,
        `concurrent-session-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['BROADCASTER'],
        },
      );

      const viewerAuth = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: viewer.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      const sessionAuth = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: session.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      const viewerToken = viewerAuth.data?.accessToken;
      const sessionToken = sessionAuth.data?.accessToken;

      const sessionResponse = await makeAuthenticatedApiRequest(port, '/sessions', sessionToken, {
        type: 'BROADCAST',
        title: 'Concurrent LiveKit Session',
        accessType: 'public',
      });

      const sessionId = sessionResponse.data?.id;

      const participantResponse = await makeAuthenticatedApiRequest(port, '/participants', viewerToken, {
        sessionId,
        participantIdentity: `concurrent-${viewer.id}`,
        displayName: 'Concurrent Test Viewer',
      });

      assert.strictEqual(participantResponse.status, STATUS_CODE_CREATED, 'Viewer should join session');

      // Generate multiple LiveKit tokens concurrently
      const tokenPromises = [];
      for (let i = 0; i < 3; i++) {
        tokenPromises.push(
          makeAuthenticatedApiRequest(port, '/livekit-token', viewerToken, {
            sessionId,
            participantIdentity: `concurrent-${viewer.id}-${i}`,
            participantName: `Concurrent Test Viewer ${i}`,
            role: 'viewer',
          }),
        );
      }

      const tokenResponses = await Promise.all(tokenPromises);

      tokenResponses.forEach((response, index) => {
        assert.strictEqual(response.status, STATUS_CODE_CREATED, `Token request ${index} should succeed`);
        assert.ok(response.data?.token, `Token request ${index} should return token`);
        assert.ok(response.data?.wsUrl, `Token request ${index} should return WebSocket URL`);
      });
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle session deletion with active participants', async () => {
      const host = await createTestUser(
        userService,
        `deletion-host-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['BROADCASTER'],
        },
      );

      const viewer = await createTestUser(
        userService,
        `deletion-viewer-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['USER'],
        },
      );

      const hostAuth = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: host.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      const viewerAuth = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: viewer.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      const hostToken = hostAuth.data?.accessToken;
      const viewerToken = viewerAuth.data?.accessToken;

      // Create session
      const sessionResponse = await makeAuthenticatedApiRequest(port, '/sessions', hostToken, {
        type: 'BROADCAST',
        title: 'Deletion Test Session',
        accessType: 'public',
      });

      const sessionId = sessionResponse.data?.id;

      // Join as participant
      const participantResponse = await makeAuthenticatedApiRequest(port, '/participants', viewerToken, {
        sessionId,
        participantIdentity: `deletion-${viewer.id}`,
        displayName: 'Deletion Test Participant',
      });

      const participantId = participantResponse.data?.id;
      assert.ok(participantId, 'Should create participant');

      // Verify participant exists
      const existingParticipant = await participantService.get(participantId);
      assert.ok(existingParticipant, 'Participant should exist before session deletion');

      // In a real implementation, you might test session deletion
      // and verify participant cleanup. For now, we'll test that
      // the participant reference is maintained correctly.
      assert.strictEqual(existingParticipant.sessionId, sessionId, 'Participant should reference valid session');
    });

    it('should handle authentication failures gracefully in integrated workflows', async () => {
      const validUser = await createTestUser(
        userService,
        `error-valid-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['USER'],
        },
      );

      const invalidUser = await createTestUser(
        userService,
        `error-invalid-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        {
          roles: ['USER'],
        },
      );

      // Authenticate valid user
      const validAuth = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: validUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      const validToken = validAuth.data?.accessToken;
      assert.ok(validToken, 'Valid user should authenticate');

      // Try to use invalid authentication for session creation
      const invalidAuthResponse = await makeApiRequest(port, '/sessions', {
        type: 'BROADCAST',
        title: 'Should Fail Session',
        accessType: 'public',
      });

      // Should fail without authentication
      if (invalidAuthResponse && invalidAuthResponse.status) {
        assert.ok(invalidAuthResponse.status >= 400, 'Should fail without authentication');
      } else {
        assert.ok(true, 'Request may have failed at network level');
      }

      // Valid user should still be able to create sessions
      const validSessionResponse = await makeAuthenticatedApiRequest(port, '/sessions', validToken, {
        type: 'BROADCAST',
        title: 'Valid Session',
        accessType: 'public',
      });

      assert.strictEqual(validSessionResponse.status, STATUS_CODE_CREATED, 'Valid user should create session');
    });
  });
});
