/**
 * @fileoverview Real-time Communication Tests - Enhanced & Modernized
 *
 * Enhanced real-time communication tests with comprehensive LiveKit integration testing,
 * scenario-based testing, and proper resource management.
 *
 * **Modernization Improvements:**
 * - TestServiceBuilder for unified setup/teardown with performance monitoring
 * - Scenario factories for realistic multi-user testing
 * - Proper LiveKit room lifecycle management
 * - Comprehensive token validation and security testing
 * - Integration testing with sessions and participants
 *
 * **Purpose:**
 * - Test LiveKit token generation and validation
 * - Validate real-time room management
 * - Test participant connection and management
 * - Verify real-time communication integration
 * - Performance and scalability testing
 *
 * **Note:** Uses modern TestServiceBuilder for unified setup/teardown
 * **Note:** Includes comprehensive LiveKit integration testing
 * **Note:** Enhanced with scenario factories for realistic testing
 * **Note:** Includes performance monitoring and proper cleanup
 */

import assert from 'assert';
import { RoomServiceClient, TokenVerifier } from 'livekit-server-sdk';
import { SessionType } from '@prisma/client';

import {
  TestServiceBuilder,
  quickP2P,
  quickBroadcast,
  createTestUser,
  createUsers,
  STATUS_CODE_CREATED,
  STATUS_CODE_SUCCESS,
  DEFAULT_PASSWORD_STRONG,
} from '@/test-utils';
import { getApp } from '@/app';

describe('Sessions Service - Real-time Communication (Enhanced)', () => {
  let builder: TestServiceBuilder;
  let userService: any;
  let sessionService: any;
  let participantService: any;
  let livekitTokenService: any;
  let roomService: RoomServiceClient;
  let app: any;

  before(async () => {
    // Initialize modern test utilities with unified setup
    builder = await new TestServiceBuilder()
      .withPerformanceMonitoring()
      .withServiceDiscovery(() => getApp())
      .build();

    // Get application and services
    app = getApp();
    userService = app.service('users');
    sessionService = app.service('sessions');
    participantService = app.service('participants');
    livekitTokenService = app.service('livekit-token');

    // Set LiveKit configuration for tests
    app.set('livekit', {
      apiKey: 'devkey',
      apiSecret: 'secret',
      wsUrl: 'ws://localhost:7880',
    });

    // Initialize LiveKit RoomServiceClient
    roomService = new RoomServiceClient(
      app.get('livekit').wsUrl,
      app.get('livekit').apiKey,
      app.get('livekit').apiSecret,
    );
  });

  after(async () => {
    await builder.cleanup();
  });

  describe('LiveKit Token Generation & Validation', () => {
    it('should generate valid LiveKit token for broadcast session', async () => {
      // Create test user and broadcast session
      const { users } = await createUsers(userService)
        .withPassword(DEFAULT_PASSWORD_STRONG)
        .withEmail(`broadcast-token-${Date.now()}@example.com`)
        .withRoles('BROADCASTER')
        .build();

      const broadcaster = users[0];

      const session = await sessionService.create({
        title: 'Token Test Broadcast',
        type: SessionType.BROADCAST,
        hostId: broadcaster.id,
        maxParticipants: 100,
        isPublic: true,
      });

      // Generate LiveKit token for the session
      const sessionId = session.id;
      const participantIdentity = 'broadcaster-token-test';
      const participantName = 'Token Test Broadcaster';

      const tokenResponse = await livekitTokenService.create({
        sessionId,
        participantIdentity,
        participantName,
        role: 'host',
      });

      // Validate token response structure
      assert.ok(tokenResponse, 'Should return token response');
      assert.ok(tokenResponse.token, 'Should have token');
      assert.ok(tokenResponse.wsUrl, 'Should have WebSocket URL');
      assert.ok(tokenResponse.participantIdentity, 'Should have participant identity');

      // Verify token validity and claims
      const verifier = new TokenVerifier(app.get('livekit').apiKey, app.get('livekit').apiSecret);
      const decoded = await verifier.verify(await tokenResponse.token);

      assert.strictEqual(decoded.sub, participantIdentity, 'Token subject should match participant identity');
      assert.strictEqual(decoded.video?.room, sessionId, 'Token room should match session ID');
      assert.ok(decoded.video?.canPublish, 'Host should be able to publish');

      // Cleanup
      await sessionService.remove(session.id);
      await userService.remove(broadcaster.id);
    });

    it('should generate valid LiveKit token for P2P session', async () => {
      // Create test users for P2P session
      const { users } = await createUsers(userService)
        .withPassword(DEFAULT_PASSWORD_STRONG)
        .withEmail(`p2p-token-${Date.now()}@example.com`)
        .withRoles('USER')
        .build();

      const hostUser = users[0];

      const session = await sessionService.create({
        title: 'Token Test P2P',
        type: SessionType.P2P,
        hostId: hostUser.id,
        maxParticipants: 2,
        isPublic: true,
      });

      // Generate LiveKit token for P2P participant
      const sessionId = session.id;
      const participantIdentity = 'p2p-participant-token';
      const participantName = 'P2P Participant';

      const tokenResponse = await livekitTokenService.create({
        sessionId,
        participantIdentity,
        participantName,
        role: 'participant',
      });

      // Validate token response
      assert.ok(tokenResponse, 'Should return token response');
      assert.ok(tokenResponse.token, 'Should have token');
      assert.ok(tokenResponse.wsUrl, 'Should have WebSocket URL');
      assert.ok(tokenResponse.participantIdentity, 'Should have participant identity');

      // Verify token validity
      const verifier = new TokenVerifier(app.get('livekit').apiKey, app.get('livekit').apiSecret);
      const decoded = await verifier.verify(await tokenResponse.token);

      assert.strictEqual(decoded.sub, participantIdentity, 'Token subject should match');
      assert.strictEqual(decoded.video?.room, sessionId, 'Token room should match session');

      // Cleanup
      await sessionService.remove(session.id);
      for (const user of users) {
        await userService.remove(user.id);
      }
    });

    it('should handle multiple token generations for same session', async () => {
      // Create broadcast session
      const users = await createUsers(userService)
        .withPassword(DEFAULT_PASSWORD_STRONG)
        .withEmail(`multi-token-${Date.now()}@example.com`)
        .withRoles('BROADCASTER')
        .build();

      const broadcaster = users;

      const session = await sessionService.create({
        title: 'Multi-Token Test',
        type: SessionType.BROADCAST,
        hostId: (broadcaster as any).id,
        maxParticipants: 50,
      });

      // Generate multiple tokens for different participants
      const tokenRequests = [
        { identity: 'host-token', name: 'Host', role: 'host' },
        { identity: 'viewer1-token', name: 'Viewer 1', role: 'viewer' },
        { identity: 'viewer2-token', name: 'Viewer 2', role: 'viewer' },
        { identity: 'moderator-token', name: 'Moderator', role: 'moderator' },
      ];

      const tokenResponses = [];
      for (const req of tokenRequests) {
        const response = await livekitTokenService.create({
          sessionId: session.id,
          participantIdentity: req.identity,
          participantName: req.name,
          role: req.role,
        });
        tokenResponses.push(response);
      }

      // Validate all tokens
      assert.strictEqual(tokenResponses.length, 4, 'Should generate all requested tokens');

      for (let i = 0; i < tokenResponses.length; i++) {
        const response: any = tokenResponses[i];
        const req = tokenRequests[i];

        assert.ok(response.token, `Token ${i} should be valid`);
        assert.strictEqual(response.participantIdentity, req.identity, `Token ${i} should have correct identity`);

        // Verify token with LiveKit verifier
        const verifier = new TokenVerifier(app.get('livekit').apiKey, app.get('livekit').apiSecret);
        const decoded = await verifier.verify(await response.token);

        assert.strictEqual(decoded.sub, req.identity, `Decoded token ${i} should have correct subject`);
        assert.strictEqual(decoded.video?.room, session.id, `Decoded token ${i} should have correct room`);
      }

      // Cleanup
      await sessionService.remove(session.id);
      await userService.remove((broadcaster as any).id);
    });

    it('should validate token security and permissions', async () => {
      // Create test user and session
      const users = await createUsers(userService)
        .withPassword(DEFAULT_PASSWORD_STRONG)
        .withEmail(`token-security-${Date.now()}@example.com`)
        .withRoles('USER')
        .build();

      const testUser = users[0];

      const session = await sessionService.create({
        title: 'Token Security Test',
        type: SessionType.BROADCAST,
        hostId: testUser.id,
        maxParticipants: 10,
      });

      // Generate tokens with different roles
      const hostToken = await livekitTokenService.create({
        sessionId: session.id,
        participantIdentity: 'host-security',
        participantName: 'Host User',
        role: 'host',
      });

      const viewerToken = await livekitTokenService.create({
        sessionId: session.id,
        participantIdentity: 'viewer-security',
        participantName: 'Viewer User',
        role: 'viewer',
      });

      // Verify host permissions
      const hostVerifier = new TokenVerifier(app.get('livekit').apiKey, app.get('livekit').apiSecret);
      const hostDecoded = await hostVerifier.verify(await hostToken.token);

      assert.ok(hostDecoded.video?.canPublish, 'Host should be able to publish');
      assert.ok(hostDecoded.video?.canSubscribe, 'Host should be able to subscribe');

      // Verify viewer permissions
      const viewerVerifier = new TokenVerifier(app.get('livekit').apiKey, app.get('livekit').apiSecret);
      const viewerDecoded = await viewerVerifier.verify(await viewerToken.token);

      assert.ok(!viewerDecoded.video?.canPublish, 'Viewer should not be able to publish');
      assert.ok(viewerDecoded.video?.canSubscribe, 'Viewer should be able to subscribe');

      // Cleanup
      await sessionService.remove(session.id);
      await userService.remove(testUser.id);
    });
  });

  describe('LiveKit Room Management Integration', () => {
    it('should create and manage LiveKit room lifecycle', async () => {
      const roomName = `test-room-${Date.now()}`;

      // Create LiveKit room
      const createdRoom = await roomService.createRoom({
        name: roomName,
      });

      assert.strictEqual(createdRoom.name, roomName, 'Room should have correct name');
      assert.ok(createdRoom.sid, 'Room should have server ID');

      // List rooms to verify creation
      const rooms = await roomService.listRooms();
      const roomExists = rooms.some((room: any) => room.name === roomName);
      assert.ok(roomExists, 'Room should exist in room list');

      // Delete room
      await roomService.deleteRoom(roomName);

      // Verify deletion
      const finalRooms = await roomService.listRooms();
      const roomStillExists = finalRooms.some((room: any) => room.name === roomName);
      assert.ok(!roomStillExists, 'Room should be deleted');
    });

    it('should handle concurrent room operations', async () => {
      // Test multiple room operations simultaneously
      const roomOperations = [
        { name: `concurrent-room-1-${Date.now()}`, type: 'broadcast' },
        { name: `concurrent-room-2-${Date.now()}`, type: 'p2p' },
        { name: `concurrent-room-3-${Date.now()}`, type: 'meeting' },
      ];

      // Create multiple rooms concurrently
      const createPromises = roomOperations.map((room) =>
        roomService.createRoom({
          name: room.name,
          // metadata handled separately if needed
        }),
      );

      const createdRooms = await Promise.all(createPromises);

      // Verify all rooms were created
      assert.strictEqual(createdRooms.length, 3, 'Should create all rooms');
      createdRooms.forEach((room, index) => {
        assert.strictEqual(room.name, roomOperations[index].name, `Room ${index} should have correct name`);
      });

      // List rooms to verify all exist
      const rooms = await roomService.listRooms();
      const ourRooms = rooms.filter((room: any) => roomOperations.some((op) => op.name === room.name));
      assert.strictEqual(ourRooms.length, 3, 'All rooms should exist in list');

      // Delete all rooms concurrently
      const deletePromises = roomOperations.map((room) => roomService.deleteRoom(room.name));

      await Promise.all(deletePromises);

      // Verify all rooms were deleted
      const finalRooms = await roomService.listRooms();
      const remainingRooms = finalRooms.filter((room: any) => roomOperations.some((op) => op.name === room.name));
      assert.strictEqual(remainingRooms.length, 0, 'All rooms should be deleted');
    });
  });

  describe('Real-time Session Integration Testing', () => {
    it('should integrate LiveKit with broadcast sessions', async () => {
      // Create broadcast session with scenario factory
      const scenario = await quickBroadcast(userService, sessionService, participantService, {
        userCount: 3,
        sessionCount: 1,
        participantsPerSession: 2,
      });

      const session = scenario.sessions[0];
      const hostUser = scenario.users.find((u: any) => u.roles?.includes('BROADCASTER'));

      // Generate LiveKit token for broadcast session
      const tokenResponse = await livekitTokenService.create({
        sessionId: session.id,
        participantIdentity: `broadcast-host-${session.id}`,
        participantName: 'Broadcast Host',
        role: 'host',
      });

      assert.ok(tokenResponse, 'Should generate token for broadcast session');
      assert.ok(tokenResponse.token, 'Should have valid token');

      // Verify token includes session information
      const verifier = new TokenVerifier(app.get('livekit').apiKey, app.get('livekit').apiSecret);
      const decoded = await verifier.verify(await tokenResponse.token);

      assert.strictEqual(decoded.video?.room, session.id, 'Token should reference correct session');
      assert.ok(decoded.video?.canPublish, 'Host should be able to publish');

      await scenario.cleanup();
    });

    it('should integrate LiveKit with P2P sessions', async () => {
      // Create P2P session with scenario factory
      const scenario = await quickP2P(userService, sessionService, participantService, {
        userCount: 2,
        sessionCount: 1,
        participantsPerSession: 2,
      });

      const session = scenario.sessions[0];

      // Generate LiveKit tokens for all participants
      const tokenPromises = scenario.users.map((user: any, index: number) =>
        livekitTokenService.create({
          sessionId: session.id,
          participantIdentity: `p2p-user-${index}-${session.id}`,
          participantName: `P2P User ${index}`,
          role: index === 0 ? 'host' : 'participant',
        }),
      );

      const tokenResponses = await Promise.all(tokenPromises);

      // Verify all tokens are valid and unique
      assert.strictEqual(tokenResponses.length, 2, 'Should generate tokens for all users');

      for (let i = 0; i < tokenResponses.length; i++) {
        const response = tokenResponses[i];
        assert.ok(response.token, `Token ${i} should be valid`);
        assert.ok(response.participantIdentity, `Token ${i} should have identity`);

        // Verify token validity
        const verifier = new TokenVerifier(app.get('livekit').apiKey, app.get('livekit').apiSecret);
        const decoded = await verifier.verify(await response.token);

        assert.strictEqual(decoded.video?.room, session.id, `Token ${i} should reference correct session`);
        assert.ok(decoded.video?.canSubscribe, `Participant ${i} should be able to subscribe`);
      }

      await scenario.cleanup();
    });

    it('should validate LiveKit service registration and configuration', async () => {
      // Test that LiveKit service is properly registered
      assert.ok(livekitTokenService, 'LiveKit token service should be available');
      assert.ok(typeof livekitTokenService.create === 'function', 'Should have create method');
      assert.ok(typeof livekitTokenService.find === 'function', 'Should have find method');
      assert.ok(typeof livekitTokenService.get === 'function', 'Should have get method');

      // Test LiveKit configuration
      const livekitConfig = app.get('livekit');
      assert.ok(livekitConfig, 'Should have LiveKit configuration');
      assert.ok(livekitConfig.apiKey, 'Should have API key');
      assert.ok(livekitConfig.apiSecret, 'Should have API secret');
      assert.ok(livekitConfig.wsUrl, 'Should have WebSocket URL');

      // Test RoomServiceClient initialization
      assert.ok(roomService, 'RoomServiceClient should be initialized');
      assert.ok(typeof roomService.createRoom === 'function', 'Should have createRoom method');
      assert.ok(typeof roomService.listRooms === 'function', 'Should have listRooms method');
      assert.ok(typeof roomService.deleteRoom === 'function', 'Should have deleteRoom method');
    });
  });

  describe('Real-time Performance & Scalability', () => {
    it('should handle multiple token generations efficiently', async () => {
      // Create broadcast session for performance testing
      const users = await createUsers(userService)
        .withPassword(DEFAULT_PASSWORD_STRONG)
        .withEmail(`perf-test-${Date.now()}@example.com`)
        .withRoles('BROADCASTER')
        .build();

      const broadcaster = users[0];

      const session = await sessionService.create({
        title: 'Performance Test Session',
        type: SessionType.BROADCAST,
        hostId: broadcaster.id,
        maxParticipants: 100,
      });

      // Generate many tokens for performance testing
      const tokenCount = 20;
      const startTime = Date.now();

      const tokenPromises = [];
      for (let i = 0; i < tokenCount; i++) {
        tokenPromises.push(
          livekitTokenService.create({
            sessionId: session.id,
            participantIdentity: `perf-user-${i}`,
            participantName: `Performance User ${i}`,
            role: i === 0 ? 'host' : 'viewer',
          }),
        );
      }

      const tokenResponses = await Promise.all(tokenPromises);
      const endTime = Date.now();

      // Verify performance
      assert.strictEqual(tokenResponses.length, tokenCount, 'Should generate all tokens');
      const totalTime = endTime - startTime;
      const avgTimePerToken = totalTime / tokenCount;

      // Performance should be reasonable (less than 100ms per token on average)
      assert.ok(avgTimePerToken < 100, `Average token generation time should be < 100ms, was ${avgTimePerToken}ms`);

      // Verify all tokens are valid
      for (const response of tokenResponses) {
        assert.ok(response.token, 'Each token should be valid');
        assert.ok(response.participantIdentity, 'Each token should have identity');
      }

      // Cleanup
      await sessionService.remove(session.id);
      await userService.remove(broadcaster.id);
    });

    it('should validate modern test utility integration', async () => {
      // Test that modern utilities are properly integrated
      assert.ok(builder, 'TestServiceBuilder should be available');
      assert.ok(typeof builder.getPort === 'function', 'Builder should provide port access');
      assert.ok(typeof builder.cleanup === 'function', 'Builder should provide cleanup');

      // Test performance monitoring integration
      assert.ok(builder.getPerformanceMetrics, 'Should have performance metrics');
      assert.ok(builder.getCacheStats, 'Should have cache statistics');

      // Test LiveKit service integration
      assert.ok(livekitTokenService, 'LiveKit token service should be available');
      assert.ok(roomService, 'RoomServiceClient should be available');

      // Test configuration constants
      assert.ok(DEFAULT_PASSWORD_STRONG, 'Should have strong password constant');
      assert.ok(typeof DEFAULT_PASSWORD_STRONG === 'string', 'Password should be string type');
    });
  });
});
