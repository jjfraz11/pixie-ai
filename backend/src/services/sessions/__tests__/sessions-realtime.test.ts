import { Application, Params } from '@feathersjs/feathers';
import assert from 'assert';
import { AccessToken, RoomServiceClient, TokenVerifier } from 'livekit-server-sdk';

import { getApp } from '@/app';
import { TestServiceBuilder, createTestUser, DEFAULT_PASSWORD_STRONG } from '@/test-utils';

// Define custom params interface for testing
interface TestParams extends Params {
  user?: {
    id: string;
    roles: string[];
  };
}

describe('Real-time Communication Features Tests', () => {
  let builder: TestServiceBuilder;
  let app: Application;
  let userService: any;
  let roomService: RoomServiceClient;
  let livekitTokenService: any;

  before(async () => {
    // Initialize modern test utilities with unified setup
    builder = await new TestServiceBuilder()
      .withPerformanceMonitoring()
      .withServiceDiscovery(() => getApp())
      .build();

    app = getApp();

    // Set livekit configuration for tests
    app.set('livekit', {
      apiKey: 'devkey',
      apiSecret: 'secret',
      wsUrl: 'ws://localhost:7880',
    });

    // Get service instances after server starts
    userService = app.service('users');
    livekitTokenService = app.service('livekit-token');

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

  it('should generate a valid LiveKit token', async () => {
    // Create a test user
    const testUser = await createTestUser(userService, 'realtime-test@example.com', DEFAULT_PASSWORD_STRONG, {
      roles: ['user'],
    });

    const sessionId = 'test-session-livekit';
    const participantIdentity = 'test-participant';
    const participantName = 'Test Participant';

    const tokenResponse = await livekitTokenService.create(
      {
        sessionId,
        participantIdentity,
        participantName,
        role: 'viewer',
      },
      {
        user: {
          id: testUser.id,
          roles: testUser.roles,
        },
      } as TestParams,
    );

    assert.ok(tokenResponse);
    const token = await tokenResponse.token; // Await the token promise
    assert.ok(token);
    assert.ok(tokenResponse.wsUrl);
    assert.ok(tokenResponse.participantIdentity);

    // Verify the token (decode and check claims)
    const verifier = new TokenVerifier(app.get('livekit').apiKey, app.get('livekit').apiSecret);
    const decoded = await verifier.verify(token);
    console.log(decoded);
    assert.strictEqual(decoded.sub, participantIdentity); // Changed to decoded.sub
    assert.strictEqual(decoded.video?.room, sessionId);
  });

  it('should create and delete a LiveKit room', async () => {
    const roomName = 'test-livekit-room';

    // Create room
    const createdRoom = await roomService.createRoom({ name: roomName });
    assert.strictEqual(createdRoom.name, roomName);

    // List rooms to verify creation
    const rooms = await roomService.listRooms();
    const roomExists = rooms.some((room: any) => room.name === roomName);
    assert.ok(roomExists, `Room ${roomName} should exist after creation`);

    // Delete room
    await roomService.deleteRoom(roomName);

    // List rooms to verify deletion
    const updatedRooms = await roomService.listRooms();
    const roomStillExists = updatedRooms.some((room: any) => room.name === roomName);
    assert.ok(!roomStillExists, `Room ${roomName} should not exist after deletion`);
  });

  // Add more real-time tests:
  // - Simulate participant join/leave using LiveKit client SDK (requires more setup)
  // - Test audio/video mute/unmute functionality
  // - Test screen sharing
  // - Test connection quality changes
});
