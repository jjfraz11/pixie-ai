import { assert } from 'chai';
import { getApp } from '../../../../src/app';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
describe('Real-time Communication Features Tests', () => {
    let app;
    let testUser;
    let roomService;
    before(async () => {
        app = await getApp();
        // Create a test user
        testUser = await app.service('users').create({
            email: 'realtime-test@example.com',
            password: 'RealtimePass123!',
            roles: ['user'],
        });
        // Initialize LiveKit RoomServiceClient
        roomService = new RoomServiceClient(process.env.LIVEKIT_WS_URL || 'ws://localhost:7880', process.env.LIVEKIT_API_KEY || 'devkey', process.env.LIVEKIT_API_SECRET || 'secret');
    });
    it('should generate a valid LiveKit token', async () => {
        const sessionId = 'test-session-livekit';
        const participantIdentity = 'test-participant';
        const participantName = 'Test Participant';
        const tokenResponse = await app.service('livekit-token').create({
            sessionId,
            participantIdentity,
            participantName,
            role: 'viewer',
        }, {
            authentication: { strategy: 'jwt', accessToken: 'some-token' },
            user: testUser,
        });
        assert.isObject(tokenResponse);
        assert.property(tokenResponse, 'token');
        assert.property(tokenResponse, 'wsUrl');
        assert.property(tokenResponse, 'participantIdentity');
        // Verify the token (decode and check claims)
        const decodedToken = AccessToken.decode(tokenResponse.token);
        assert.equal(decodedToken.grants.identity, participantIdentity);
        assert.equal(decodedToken.grants.video.room, sessionId);
    });
    it('should create and delete a LiveKit room', async () => {
        const roomName = 'test-livekit-room';
        // Create room
        const createdRoom = await roomService.createRoom({ name: roomName });
        assert.equal(createdRoom.name, roomName);
        // List rooms to verify creation
        const rooms = await roomService.listRooms();
        assert.isTrue(rooms.some(room => room.name === roomName));
        // Delete room
        await roomService.deleteRoom(roomName);
        // List rooms to verify deletion
        const updatedRooms = await roomService.listRooms();
        assert.isFalse(updatedRooms.some(room => room.name === roomName));
    });
    // Add more real-time tests:
    // - Simulate participant join/leave using LiveKit client SDK (requires more setup)
    // - Test audio/video mute/unmute functionality
    // - Test screen sharing
    // - Test connection quality changes
});
